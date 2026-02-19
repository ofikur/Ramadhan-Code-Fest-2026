// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./ArcBaseCollection.sol";

/**
 * @title ArcBaseFactory
 * @dev Factory contract untuk men-deploy koleksi ArcBaseCollection baru.
 *      Menggunakan CREATE2 untuk alamat deterministik.
 *      Menyimpan registry semua koleksi yang dibuat oleh protokol ini.
 */
contract ArcBaseFactory is OwnableUpgradeable, UUPSUpgradeable {
    // Address dari kontrak implementasi ArcBaseCollection (Logic Contract)
    address public implementationContract;

    // Registry koleksi yang sudah dideploy
    address[] public deployedCollections;
    
    // Mapping untuk mengecek apakah alamat tertentu adalah koleksi ArcBase valid
    mapping(address => bool) public isArcBaseCollection;

    // --- Events ---
    
    event CollectionDeployed(
        address indexed creator,
        address indexed collection,
        bytes32 salt
    );
    
    event ImplementationUpdated(address newImplementation);

    // --- Errors ---
    
    error ImplementationNotSet();
    error DeploymentFailed();

    // --- Constructor & Initialization ---

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _implementationContract) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        
        implementationContract = _implementationContract;
    }

    // --- Deployment Functions ---

    /**
     * @dev Deploy koleksi baru menggunakan CREATE2.
     * @param name Nama koleksi
     * @param symbol Simbol koleksi
     * @param maxSupply Total supply
     * @param mintPrice Harga mint
     * @param initialBaseURI URI awal
     * @param royaltyReceiver Penerima royalti
     * @param royaltyFee Fee royalti (basis 10000)
     * @param shares Konfigurasi pembagian hasil
     * @param saltBytes Garam tambahan untuk variasi alamat
     */
    function deployCollection(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 mintPrice,
        string memory initialBaseURI,
        address royaltyReceiver,
        uint96 royaltyFee,
        ArcBaseCollection.RevenueShare[] memory shares,
        bytes32 saltBytes
    ) external returns (address) {
        if (implementationContract == address(0)) revert ImplementationNotSet();

        // 1. Hitung Salt Deterministik
        // Kombinasi: msg.sender + nama + chainId + saltBytes user
        bytes32 salt = keccak256(
            abi.encodePacked(msg.sender, name, block.chainid, saltBytes)
        );

        // 2. Encode Data Inisialisasi
        bytes memory initializedata = abi.encodeWithSelector(
            ArcBaseCollection.initialize.selector,
            name,
            symbol,
            maxSupply,
            mintPrice,
            initialBaseURI,
            royaltyReceiver,
            royaltyFee,
            shares,
            msg.sender // Owner koleksi adalah pengirim transaksi
        );

        // 3. Deploy Proxy menggunakan CREATE2 (lewat assembly atau library)
        // Kita menggunakan ERC1967Proxy standar
        address proxy = address(new ERC1967Proxy{salt: salt}(
            implementationContract,
            initializedata
        ));

        if (proxy == address(0)) revert DeploymentFailed();

        // 4. Catat Koleksi
        deployedCollections.push(proxy);
        isArcBaseCollection[proxy] = true;

        emit CollectionDeployed(msg.sender, proxy, salt);
        
        return proxy;
    }

    /**
     * @dev Menghitung alamat koleksi sebelum dideploy (Frontend Helper).
     *      PENTING: Gunakan ini di frontend untuk preview alamat.
     */
    function getCollectionAddress(
        string memory name,
        string memory symbol,
        uint256 maxSupply,
        uint256 mintPrice,
        string memory initialBaseURI,
        address royaltyReceiver,
        uint96 royaltyFee,
        ArcBaseCollection.RevenueShare[] memory shares,
        bytes32 saltBytes,
        address sender
    ) external view returns (address) {
         bytes32 salt = keccak256(
            abi.encodePacked(sender, name, block.chainid, saltBytes)
        );

        bytes memory initializedata = abi.encodeWithSelector(
            ArcBaseCollection.initialize.selector,
            name,
            symbol,
            maxSupply,
            mintPrice,
            initialBaseURI,
            royaltyReceiver,
            royaltyFee,
            shares,
            sender
        );

        bytes memory bytecode = abi.encodePacked(
            type(ERC1967Proxy).creationCode,
            abi.encode(implementationContract, initializedata)
        );

        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );

        // Cast last 20 bytes to address
        return address(uint160(uint256(hash)));
    }


    // --- Admin Functions ---

    function setImplementation(address _newImplementation) external onlyOwner {
        implementationContract = _newImplementation;
        emit ImplementationUpdated(_newImplementation);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    // --- Storage Gap ---
    uint256[50] private __gap;
}
