// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/EIP712Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";

/**
 * @title ArcBaseCollection
 * @dev Implementasi Koleksi NFT untuk ArcBase Protocol.
 *      Menggunakan standar ERC721A untuk optimasi gas (batch minting).
 *      Mendukung pola UUPS Upgradeable dengan mekanisme freeze metadata permanen.
 *      Termasuk fitur whitelist minting dengan tanda tangan (EIP-712),
 *      pembagian pendapatan (revenue split), dan royalti (EIP-2981).
 */
contract ArcBaseCollection is
    ERC721AUpgradeable,
    OwnableUpgradeable,
    UUPSUpgradeable,
    ReentrancyGuardUpgradeable,
    EIP712Upgradeable
{
    using ECDSAUpgradeable for bytes32;

    // --- Struktur Data ---

    struct RevenueShare {
        address recipient;
        uint256 percentage; // Basis point (contoh: 500 = 5%)
    }

    // --- State Variables ---

    // Konfigurasi Royalti (Packed untuk optimasi storage)
    // Slot 1: 160 bits (address) + 96 bits (uint96) = 256 bits
    address private _royaltyReceiver;
    uint96 private _royaltyFeeNumerator; // Basis 10000 (contoh: 500 = 5%)

    // Konfigurasi Koleksi
    string public baseURI;
    uint256 public maxSupply;
    uint256 public publicMintPrice;
    
    // Status Freeze Metadata & Upgrade
    bool public isMetadataFrozen;

    // Revenue Split (Immutable setelah inisialisasi)
    RevenueShare[] public revenueShares;
    mapping(address => uint256) public pendingRevenue;

    // Signature Protection (Anti-Replay)
    // Mapping dari user address ke nonce terkini mereka
    mapping(address => uint256) public nonces;

    // Typehash untuk EIP-712 Whitelist Mint
    bytes32 private constant WHITELIST_MINT_TYPEHASH =
        keccak256("WhitelistMint(address minter,uint256 quantity,uint256 price,uint256 nonce)");

    // --- Events ---

    event MetadataFrozen(address indexed collection);
    event RevenueWithdrawn(address indexed recipient, uint256 amount);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    // --- Errors ---

    error MetadataIsFrozen();                 // Metadata sudah dibekukan
    error ExceedsMaxSupply();                 // Melebihi batas maksimal supply
    error InsufficientPayment();              // Pembayaran tidak cukup
    error InvalidSignature();                 // Tanda tangan tidak valid
    error InvalidRevenueSplit();              // Total share tidak 100%
    error NoRevenueToWithdraw();              // Tidak ada dana untuk ditarik
    error TransferFailed();                   // Gagal transfer ETH

    // --- Constructor & Initialization ---

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @dev Fungsi inisialisasi pengganti constructor untuk kontrak upgradeable.
     * @param _name Nama koleksi NFT
     * @param _symbol Simbol koleksi NFT
     * @param _maxSupply Total supply maksimum
     * @param _mintPrice Harga minting publik (dalam wei)
     * @param _initialBaseURI URI dasar untuk metadata (IPFS)
     * @param _royaltyReceiverAddress Alamat penerima royalti awal
     * @param _royaltyFee Fee royalti (basis 10000, misal 500 = 5%)
     * @param _shares Array konfigurasi revenue split
     * @param _owner Alamat pemilik kontrak (biasanya deployer)
     */
    function initialize(
        string memory _name,
        string memory _symbol,
        uint256 _maxSupply,
        uint256 _mintPrice,
        string memory _initialBaseURI,
        address _royaltyReceiverAddress,
        uint96 _royaltyFee,
        RevenueShare[] memory _shares,
        address _owner
    ) public initializer initializerERC721A {
        __ERC721A_init(_name, _symbol);
        __Ownable_init();
        _transferOwnership(_owner);
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();
        __EIP712_init("ArcBaseCollection", "1");

        maxSupply = _maxSupply;
        publicMintPrice = _mintPrice;
        baseURI = _initialBaseURI;
        
        // Set Royalti
        _royaltyReceiver = _royaltyReceiverAddress;
        _royaltyFeeNumerator = _royaltyFee;

        // Validasi dan Set Revenue Split
        uint256 totalShares = 0;
        for (uint256 i = 0; i < _shares.length; i++) {
            revenueShares.push(_shares[i]);
            totalShares += _shares[i].percentage;
        }
        if (totalShares != 10000) revert InvalidRevenueSplit();
    }

    // --- Minting Functions ---

    /**
     * @dev Public minting function.
     * @param quantity Jumlah NFT yang ingin dimint.
     */
    function mint(uint256 quantity) external payable nonReentrant {
        if (_totalMinted() + quantity > maxSupply) revert ExceedsMaxSupply();
        if (msg.value < publicMintPrice * quantity) revert InsufficientPayment();

        _splitRevenue(msg.value);
        _mint(msg.sender, quantity);
    }

    /**
     * @dev Whitelist minting menggunakan EIP-712 signature.
     * @param quantity Jumlah NFT.
     * @param price Harga per token khusus untuk whitelist.
     * @param signature Tanda tangan valid dari owner.
     */
    function whitelistMint(
        uint256 quantity,
        uint256 price,
        bytes calldata signature
    ) external payable nonReentrant {
        if (_totalMinted() + quantity > maxSupply) revert ExceedsMaxSupply();
        if (msg.value < price * quantity) revert InsufficientPayment();

        // Verifikasi Signature
        bytes32 structHash = keccak256(
            abi.encode(
                WHITELIST_MINT_TYPEHASH,
                msg.sender,
                quantity,
                price,
                nonces[msg.sender]
            )
        );

        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = ECDSAUpgradeable.recover(hash, signature);

        if (signer != owner()) revert InvalidSignature();

        // Increment nonce untuk mencegah replay attack
        unchecked {
            nonces[msg.sender]++;
        }

        _splitRevenue(msg.value);
        _mint(msg.sender, quantity);
    }

    // --- Revenue Management ---

    /**
     * @dev Internal function untuk membagi pendapatan ke mapping pendingRevenue.
     *      Tidak mentransfer ETH langsung untuk keamanan (Pull Payment).
     * @param amount Jumlah ETH yang masuk.
     */
    function _splitRevenue(uint256 amount) internal {
        // Menggunakan unchecked karena totalShares divalidasi == 10000 di initialize
        unchecked {
            for (uint256 i = 0; i < revenueShares.length; i++) {
                uint256 share = (amount * revenueShares[i].percentage) / 10000;
                if (share > 0) {
                    pendingRevenue[revenueShares[i].recipient] += share;
                }
            }
        }
    }

    /**
     * @dev Fungsi bagi penerima revenue untuk menarik dana mereka.
     *      Menggunakan pola Checks-Effects-Interactions.
     */
    function withdraw() external nonReentrant {
        uint256 amount = pendingRevenue[msg.sender];
        if (amount == 0) revert NoRevenueToWithdraw();

        // Effect: Reset saldo sebelum transfer
        pendingRevenue[msg.sender] = 0;
        emit RevenueWithdrawn(msg.sender, amount);

        // Interaction: Transfer ETH
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    // --- Admin & Security Functions ---

    /**
     * @dev Membekukan metadata dan konfigurasi royalti secara permanen.
     *      Juga mematikan fitur upgrade kontrak.
     */
    function freezeMetadata() external onlyOwner {
        if (isMetadataFrozen) revert MetadataIsFrozen();
        isMetadataFrozen = true;
        emit MetadataFrozen(address(this));
    }

    function setBaseURI(string calldata newBaseURI) external onlyOwner {
        if (isMetadataFrozen) revert MetadataIsFrozen();
        baseURI = newBaseURI;
        emit BatchMetadataUpdate(0, type(uint256).max);
    }

    function setRoyaltyInfo(address receiver, uint96 feeNumerator) external onlyOwner {
        if (isMetadataFrozen) revert MetadataIsFrozen();
        _royaltyReceiver = receiver;
        _royaltyFeeNumerator = feeNumerator;
    }

    // --- Overrides ---

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {
        // PERLINDUNGAN UTAMA: Upgrade dilarang jika metadata sudah dibekukan
        if (isMetadataFrozen) revert MetadataIsFrozen();
    }

    function _baseURI() internal view override returns (string memory) {
        return baseURI;
    }

    function _startTokenId() internal view virtual override returns (uint256) {
        return 1;
    }

    /**
     * @dev Implementasi EIP-2981 Royalty Standard.
     */
    function royaltyInfo(uint256, uint256 salePrice) 
        external 
        view 
        returns (address receiver, uint256 royaltyAmount) 
    {
        return (_royaltyReceiver, (salePrice * _royaltyFeeNumerator) / 10000);
    }
    
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721AUpgradeable)
        returns (bool)
    {
        return 
            interfaceId == 0x2a55205a || // ERC2981 License
            super.supportsInterface(interfaceId);
    }

    // --- Storage Gap ---
    
    /**
     * @dev Storage gap untuk mencegah collision saat upgrade di masa depan.
     *      Penting untuk keamanan pola UUPS.
     */
    uint256[50] private __gap;
}
