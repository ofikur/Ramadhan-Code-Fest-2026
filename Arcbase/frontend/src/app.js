import { ethers } from "ethers"; // Use installed ethers
import { ABIS } from "./abis.js";
import { CONFIG } from "../config.js";
import { createAppKit, EthersAdapter, base, baseSepolia } from "./libs/appkit.bundle.js";

// --- State ---
let provider;
let signer;
let address;
let chainId;
let factoryContract;
let currentCollection;
let modal;
let pinataJwt = CONFIG.PINATA_JWT || "";

// --- UI Elements ---
const ui = {
    connectBtn: document.getElementById('connect-wallet'),
    networkBadge: document.getElementById('network-status'),
    networkSelect: document.getElementById('network-select'),
    deployForm: document.getElementById('deploy-form'),
    deployBtn: document.getElementById('deploy-btn'),
    previewAddress: document.getElementById('address-preview'),
    refreshPreviewBtn: document.getElementById('refresh-preview'),

    // IPFS / Image UI
    localImageInput: document.getElementById('local-image-input'),
    baseUriInput: document.getElementById('col-uri'),
    imagePreviewBox: document.getElementById('image-preview-box'),

    collectionSection: document.getElementById('collection-ui'),
    // Collection View
    viewName: document.getElementById('view-name'),
    viewSymbol: document.getElementById('view-symbol'),
    statMinted: document.getElementById('stat-minted'),
    statPrice: document.getElementById('stat-price'),
    statFreeze: document.getElementById('stat-freeze'),
    mintBtn: document.getElementById('mint-btn'),
    mintQty: document.getElementById('mint-qty'),
    ownerPanel: document.getElementById('owner-panel'),
    freezeBtn: document.getElementById('freeze-btn'),
    toastContainer: document.getElementById('toast-container')
};

// --- Initialization ---
async function init() {
    console.log("ArcBase Initializing with AppKit...");

    // Warn if Pinata Key missing but simplified mode expects it
    if (!pinataJwt) {
        console.warn("Pinata JWT is missing in config.js. Auto-upload will fail if used.");
    }

    // Initialize AppKit
    const projectId = CONFIG.PROJECT_ID;
    const metadata = {
        name: 'ArcBase',
        description: 'Protokol Launchpad NFT Modular',
        url: window.location.origin,
        icons: ['https://avatars.githubusercontent.com/u/179229932']
    }

    modal = createAppKit({
        adapters: [new EthersAdapter()],
        networks: [base, baseSepolia],
        metadata,
        projectId,
        features: { analytics: true }
    });

    // Subscribe to events
    modal.subscribeProviders(async (state) => {
        const evmState = state.eip155;
        // Check if we have an address directly in state
        const stateAddress = evmState ? evmState.selectedAddress : undefined;
        const isConnected = state.isConnected || !!stateAddress;

        console.log("Connection Check - Address:", stateAddress, "Connected:", isConnected);

        if (isConnected) {
            // Strategy: Get Provider
            let walletProvider = modal.getProvider();

            // Fallback 1: Window.ethereum
            if (!walletProvider && window.ethereum) {
                console.log("modal.getProvider() failed, using window.ethereum fallback");
                walletProvider = window.ethereum;
            }

            if (walletProvider) {
                provider = new ethers.BrowserProvider(walletProvider);
                try {
                    signer = await provider.getSigner();
                    address = await signer.getAddress();
                    console.log("Signer Address:", address);

                    const network = await provider.getNetwork();
                    chainId = Number(network.chainId);

                    await handleConnectionSuccess();
                } catch (err) {
                    console.error("Signer Init Error:", err);
                    // If we have state address but failing signer, we can at least show the address
                    if (stateAddress) {
                        address = stateAddress;
                        await handleConnectionSuccess();
                        showToast("Mode Read-Only (Signer Error)", "warning");
                    }
                }
            } else {
                console.error("No provider found (AppKit & Window both null)");
            }
        } else {
            handleDisconnect();
        }
    });

    // Listeners
    setupEventListeners();

    // Check initial state
    setTimeout(async () => {
        try {
            // Priority: Get Address directly
            const initAddr = modal.getAddress();
            if (initAddr) {
                console.log("Initial Address Found:", initAddr);
                address = initAddr;

                // Try to setup provider/signer
                let walletProvider = modal.getProvider();
                if (!walletProvider && window.ethereum) walletProvider = window.ethereum;

                if (walletProvider) {
                    provider = new ethers.BrowserProvider(walletProvider);
                    try {
                        signer = await provider.getSigner();
                        const network = await provider.getNetwork();
                        chainId = Number(network.chainId);
                    } catch (e) { console.warn("Init Signer Error", e); }
                }

                handleConnectionSuccess();
            } else {
                console.log("No initial connection.");
            }

            // NEW: Check for Shareable Link (?address=0x...)
            const urlParams = new URLSearchParams(window.location.search);
            const sharedAddress = urlParams.get('address');
            if (sharedAddress && ethers.isAddress(sharedAddress)) {
                // Determine provider for read-only view if checking before connect
                // Note: We need a provider to read contract data. 
                // If user is not connected, we might fail to read unless we use a public RPC.
                // For now, we rely on the user connecting wallet to view the shared collection details fully,
                // OR if they are already connected.

                // If not connected, we can't easily show the collection yet without a read-only provider setup.
                // But if they connect, we should load it.
                // Let's store it to load after connection, or try to load if provider exists.
                if (signer) {
                    loadCollection(sharedAddress);
                } else {
                    // Slight UX hack: Wait for connection then load, or prompt connect
                    console.log("Detected shared address but no signer yet.");
                    ui.collectionSection.classList.remove('hidden');
                    ui.viewName.innerText = "Connect Wallet to View Collection";
                    // store for later
                    window.pendingCollection = sharedAddress;
                }
            }

        } catch (e) {
            console.warn("Initial check error:", e);
        }
    }, 1000);
}

function setupEventListeners() {
    ui.networkSelect.addEventListener('change', async (e) => {
        const selectedChainId = Number(e.target.value);
        if (selectedChainId === chainId) return;
        try {
            if (selectedChainId === 8453) await modal.switchNetwork(base);
            else if (selectedChainId === 84532) await modal.switchNetwork(baseSepolia);
        } catch (error) {
            console.error("Failed to switch network:", error);
            showToast("Gagal ganti network: " + error.message, "error");
            ui.networkSelect.value = chainId;
        }
    });

    ui.connectBtn.addEventListener('click', () => modal.open());
    ui.deployForm.addEventListener('submit', handleDeploy);
    ui.refreshPreviewBtn.addEventListener('click', updateAddressPreview);
    ui.mintBtn.addEventListener('click', handleMint);
    ui.freezeBtn.addEventListener('click', handleFreeze);

    // Auto-update preview
    ['col-name', 'col-symbol', 'col-supply', 'col-price'].forEach(id => {
        document.getElementById(id).addEventListener('input', debounce(updateAddressPreview, 500));
    });

    // Image Preview & Mode Logic
    // If user types in Base URI -> Clear local image input
    ui.baseUriInput.addEventListener('input', debounce(() => {
        if (ui.baseUriInput.value.length > 0) {
            ui.localImageInput.value = "";
            handleImagePreview();
        }
    }, 800));

    // If user selects file -> Clear Base URI input
    ui.localImageInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            ui.baseUriInput.value = "";
            handleLocalImagePreview(e);
        }
    });
}

// --- Pinata Logic ---

async function uploadToPinata() {
    if (!pinataJwt) throw new Error("API Key Pinata belum diset di config.js! Hubungi Admin.");

    // 1. Upload Image
    const fileInput = ui.localImageInput;
    if (!fileInput.files.length) throw new Error("Pilih gambar dulu!");
    const imageFile = fileInput.files[0];

    showToast("Mengupload gambar ke IPFS...", "info");

    const formDataImg = new FormData();
    formDataImg.append('file', imageFile);

    const imgRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${pinataJwt}`
        },
        body: formDataImg
    });

    if (!imgRes.ok) throw new Error("Gagal upload gambar ke Pinata");
    const imgData = await imgRes.json();
    const imageCid = imgData.IpfsHash;
    console.log("Image CID:", imageCid);

    // 2. Create Metadata Batch
    showToast("Membuat metadata...", "info");

    const name = document.getElementById('col-name').value || "NFT Collection";
    const desc = `Collection of ${name}`;
    const supply = parseInt(document.getElementById('col-supply').value) || 10;

    const formDataMeta = new FormData();

    const metadataTemplate = {
        name: `${name} #`,
        description: desc,
        image: `ipfs://${imageCid}`,
        attributes: []
    };

    const batchSize = Math.min(supply, 100);

    for (let i = 1; i <= batchSize; i++) {
        const meta = { ...metadataTemplate, name: `${name} #${i}` };
        const blob = new Blob([JSON.stringify(meta)], { type: 'application/json' });
        formDataMeta.append('file', blob, `metadata/${i}`);
    }

    const metadataOpts = JSON.stringify({
        cidVersion: 1,
        wrapWithDirectory: false
    });
    formDataMeta.append('pinataOptions', metadataOpts);

    const pinataMeta = JSON.stringify({
        name: `${name}_Metadata_Folder`
    });
    formDataMeta.append('pinataMetadata', pinataMeta);

    showToast(`Mengupload ${batchSize} metadata ke IPFS...`, "info");

    const metaRes = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${pinataJwt}`
        },
        body: formDataMeta
    });

    if (!metaRes.ok) throw new Error("Gagal upload metadata folder");
    const metaData = await metaRes.json();
    const folderCid = metaData.IpfsHash;

    // Fix: Pinata returns CID of the folder content directly if structure is simple
    // or if wrapWithDirectory is false.
    // Based on test, files are at ipfs://CID/1 not ipfs://CID/metadata/1
    return `ipfs://${folderCid}/`;
}


// --- Image Preview Logic ---
function handleLocalImagePreview(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
        ui.imagePreviewBox.innerHTML = `
            <div style="text-align: center;">
                <img src="${e.target.result}" alt="Preview Local" style="max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;">
                <br>
                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                    <span class="badge" style="font-size: 0.7rem; background: var(--accent-color); color: white;">Siap Auto-Upload</span>
                </div>
            </div>
        `;
    }
    reader.readAsDataURL(file);
}

async function handleImagePreview() {
    const uriInput = ui.baseUriInput.value.trim();
    if (!uriInput) {
        if (!ui.localImageInput.files.length) {
            ui.imagePreviewBox.innerHTML = `
                <div class="image-preview-placeholder">
                    <span>🖼️ Preview Gambar</span>
                </div>`;
        }
        return;
    }

    ui.imagePreviewBox.innerHTML = `<div class="image-preview-placeholder"><span>🔄 Memuat preview dari IPFS...</span></div>`;

    try {
        let metadataUrl = uriInput;

        if (uriInput.startsWith("ipfs://")) {
            const path = uriInput.replace("ipfs://", "");
            metadataUrl = `https://ipfs.io/ipfs/${path}`;
        }

        if (!metadataUrl.endsWith("/")) metadataUrl += "/";
        const targetUrl = metadataUrl + "1.json";

        let response = await fetch(targetUrl);
        if (!response.ok) response = await fetch(metadataUrl + "1");

        if (!response.ok) throw new Error("Gagal mengambil metadata token #1");

        const json = await response.json();

        if (json.image) {
            let imgUrl = json.image;
            if (imgUrl.startsWith("ipfs://")) {
                imgUrl = imgUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
            }

            ui.imagePreviewBox.innerHTML = `
                <div style="text-align: center;">
                    <img src="${imgUrl}" alt="Preview Token #1" style="max-height: 200px; border-radius: 8px; margin-bottom: 0.5rem;">
                    <br>
                    <span class="badge" style="font-size: 0.7rem;">Preview Token #1 (IPFS)</span>
                </div>
             `;
        } else {
            throw new Error("Format JSON tidak dikenali");
        }

    } catch (error) {
        console.warn("Preview failed:", error);
        ui.imagePreviewBox.innerHTML = `
            <div class="image-preview-placeholder" style="color: #ef4444;">
                <span>❌ Gagal memuat preview</span>
                <span style="font-size: 0.7rem;">Error: ${error.message}</span>
            </div>`;
    }
}

function handleDisconnect() {
    ui.connectBtn.innerText = "Hubungkan Dompet";
    ui.deployBtn.disabled = true;
    ui.networkBadge.innerText = "Menunggu Koneksi...";
    ui.networkBadge.style.color = "#6b7280";
    address = null;
    signer = null;
    provider = null;
    ui.collectionSection.classList.add('hidden');
}

async function handleConnectionSuccess() {
    ui.connectBtn.innerText = `${address.substring(0, 6)}...${address.substring(38)}`;
    ui.deployBtn.disabled = false;

    // Check Network & Update Selector
    const networkConfig = CONFIG.NETWORKS[chainId];
    if (networkConfig) {
        ui.networkBadge.innerText = networkConfig.name;
        ui.networkBadge.style.color = "#10b981";

        if (ui.networkSelect.querySelector(`option[value="${chainId}"]`)) {
            ui.networkSelect.value = chainId;
        }

        if (networkConfig.factoryAddress && networkConfig.factoryAddress !== ethers.ZeroAddress) {
            factoryContract = new ethers.Contract(networkConfig.factoryAddress, ABIS.factory, signer);
        } else {
            showToast("Factory address belum diatur untuk network ini", "warning");
        }
    } else {
        ui.networkBadge.innerText = "Network Tidak Didukung";
        ui.networkBadge.style.color = "#ef4444";
        showToast("Harap ganti ke Base Sepolia atau Mainnet", "error");
        ui.deployBtn.disabled = true;
    }

    // Load Pending Collection if any (from URL)
    if (window.pendingCollection) {
        loadCollection(window.pendingCollection);
        window.pendingCollection = null;
    }
}

// --- Factory Interactions ---

// Load Button Logic
const loadBtn = document.getElementById('load-btn');
const loadInput = document.getElementById('load-address');
if (loadBtn && loadInput) {
    loadBtn.onclick = () => {
        const addr = loadInput.value.trim();
        if (ethers.isAddress(addr)) {
            loadCollection(addr);
            showToast("Memuat data koleksi...", "info");
        } else {
            showToast("Address tidak valid!", "error");
        }
    };
}

async function updateAddressPreview() {
    if (!factoryContract || !address) return;

    const name = document.getElementById('col-name').value;
    const symbol = document.getElementById('col-symbol').value;
    const saltBytes = ethers.ZeroHash;
    if (!name) return;

    try {
        const predicted = await factoryContract.getCollectionAddress(
            name, symbol || "NFT", 1000, 0, "", ethers.ZeroAddress, 0, [], saltBytes, address
        );
        ui.previewAddress.innerText = predicted;
    } catch (error) {
        ui.previewAddress.innerText = "Menunggu input lengkap...";
    }
}

async function handleDeploy(e) {
    e.preventDefault();
    if (!factoryContract) return;

    const name = document.getElementById('col-name').value;
    const symbol = document.getElementById('col-symbol').value;
    const maxSupply = document.getElementById('col-supply').value;
    const priceEth = document.getElementById('col-price').value;
    const royalty = document.getElementById('col-royalty').value;
    let baseUri = document.getElementById('col-uri').value;

    // Determine Upload Mode via logic
    const hasLocalFile = document.getElementById('local-image-input').files.length > 0;
    const hasManualUri = baseUri.trim().length > 0;

    try {
        ui.deployBtn.disabled = true;

        // Mode Logic
        if (hasLocalFile) {
            // Priority 1: Auto Upload
            if (hasManualUri) {
                if (!confirm("Anda memilih file TAPI juga mengisi Manual Link IPFS. Gunakan file yang diupload? (Link manual akan diabaikan)")) {
                    // User prefers manual
                    // Do nothing, baseUri is already set
                } else {
                    // Upload
                    baseUri = await uploadToPinata();
                    ui.baseUriInput.value = baseUri;
                    showToast("Sukses upload ke IPFS: " + baseUri, "success");
                }
            } else {
                // Std auto upload
                baseUri = await uploadToPinata();
                ui.baseUriInput.value = baseUri;
                showToast("Sukses upload ke IPFS: " + baseUri, "success");
            }
        }
        else if (!hasManualUri) {
            throw new Error("Wajib upload gambar (Auto) atau masukkan Link IPFS folder (Manual)!");
        }

        const priceWei = ethers.parseEther(priceEth.toString());
        const royaltyBasis = Math.floor(parseFloat(royalty) * 100);
        const saltBytes = ethers.ZeroHash;

        // Default 100% revenue share to creator to avoid InvalidRevenueSplit Error
        // and to ensure funds are withdrawable.
        const defaultShare = [{
            recipient: address,
            percentage: 10000 // 100%
        }];

        showToast("Memulai Deploy...", "info");

        const tx = await factoryContract.deployCollection(
            name, symbol, maxSupply, priceWei, baseUri, address, royaltyBasis, defaultShare, saltBytes
        );

        showToast("Transaksi dikirim - Menunggu konfirmasi...", "info");
        const receipt = await tx.wait();

        let deployedAddr = null;
        for (const log of receipt.logs) {
            try {
                const parsed = factoryContract.interface.parseLog(log);
                if (parsed && parsed.name === 'CollectionDeployed') {
                    deployedAddr = parsed.args.collection;
                    break;
                }
            } catch (e) { }
        }

        if (deployedAddr) {
            showToast(`Koleksi Berhasil Dideploy: ${deployedAddr}`, "success");

            // Auto Verify Proxy
            try {
                showToast("Memverifikasi Contract di Explorer...", "info");
                await verifyProxy(deployedAddr);
                showToast("Contract Verified! ✅", "success");
            } catch (vErr) {
                console.warn("Auto-verify warning:", vErr);
                showToast("Gagal Auto-Verify (Cek Explorer Manual)", "warning");
            }

            loadCollection(deployedAddr);
        } else {
            showToast("Deploy berhasil tapi alamat tidak ditemukan di logs", "warning");
        }

    } catch (error) {
        console.error(error);
        if (error.code === 4001) showToast("User menolak transaksi", "warning");
        else showToast("Gagal: " + (error.reason || error.message), "error");
    } finally {
        ui.deployBtn.disabled = false;
    }
}

// --- Collection Interactions ---

async function loadCollection(collectionAddress) {
    currentCollection = new ethers.Contract(collectionAddress, ABIS.collection, signer);

    ui.collectionSection.classList.remove('hidden');
    ui.collectionSection.scrollIntoView({ behavior: 'smooth' });

    // Load Data
    const name = await currentCollection.name();
    const symbol = await currentCollection.symbol();
    const supply = await currentCollection.totalSupply();
    const max = await currentCollection.maxSupply();
    const price = await currentCollection.publicMintPrice();
    const isFrozen = await currentCollection.isMetadataFrozen();
    const owner = await currentCollection.owner();

    ui.viewName.innerText = name;
    ui.viewSymbol.innerText = symbol;
    ui.statMinted.innerText = `${supply} / ${max}`;
    ui.statPrice.innerText = `${ethers.formatEther(price)} ETH`;
    ui.statFreeze.innerText = isFrozen ? "TERKUNCI PERMANEN" : "Aktif (Bisa Upgrade)";
    ui.statFreeze.style.color = isFrozen ? "#ef4444" : "#10b981";

    // Load Image (Visible Metadata for Collection)
    const coverImg = document.getElementById('view-cover');
    const loader = document.getElementById('view-cover-loader');

    // Add Explorer Button if not exists
    let explorerBtn = document.getElementById('explorer-btn');
    if (!explorerBtn) {
        const btnContainer = document.querySelector('.collection-header');
        explorerBtn = document.createElement('a');
        explorerBtn.id = 'explorer-btn';
        explorerBtn.className = 'btn btn-small';
        explorerBtn.style.marginLeft = '1rem';
        explorerBtn.target = '_blank';
        explorerBtn.innerText = '🔍 View on Basescan';
        btnContainer.appendChild(explorerBtn);
    }

    // Set Explorer Link
    const networkConfig = CONFIG.NETWORKS[chainId];
    if (networkConfig) {
        explorerBtn.href = `${networkConfig.explorer}/address/${collectionAddress}`;
    }

    // Share Button Logic
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.onclick = () => {
            const url = window.location.origin + window.location.pathname + "?address=" + collectionAddress;
            navigator.clipboard.writeText(url).then(() => {
                showToast("Link Minting disalin! 🔗", "success");
            }).catch(err => {
                console.error(err);
                showToast("Gagal menyalin link", "error");
            });
        };
    }

    if (coverImg && loader) {
        coverImg.style.display = 'none';
        loader.style.display = 'block';

        try {
            // Fix: Use baseURI directly because tokenURI(1) reverts if no tokens minted yet
            const uri = await currentCollection.baseURI();
            let url = uri;

            // Construct path to token #1 metadata manually
            // IPFS paths usually end with / so we append 1 or 1.json
            if (url.startsWith("ipfs://")) url = url.replace("ipfs://", "https://ipfs.io/ipfs/");
            if (!url.endsWith("/")) url += "/";

            // Try fetch #1
            let res = await fetch(url + "1");
            if (!res.ok) res = await fetch(url + "1.json");

            if (res.ok) {
                const json = await res.json();
                if (json.image) {
                    let imgUrl = json.image;
                    if (imgUrl.startsWith("ipfs://")) imgUrl = imgUrl.replace("ipfs://", "https://ipfs.io/ipfs/");
                    coverImg.src = imgUrl;
                    coverImg.style.display = 'inline-block';
                }
            }
        } catch (e) {
            console.warn("Gagal load cover image:", e);
        } finally {
            loader.style.display = 'none';
        }
    }

    if (owner.toLowerCase() === address.toLowerCase()) {
        ui.ownerPanel.classList.remove('hidden');
        if (isFrozen) ui.freezeBtn.disabled = true;
    } else {
        ui.ownerPanel.classList.add('hidden');
    }
}

async function handleMint() {
    if (!currentCollection) return;

    const qty = ui.mintQty.value;
    try {
        const price = await currentCollection.publicMintPrice();
        const totalPrice = price * BigInt(qty);

        const tx = await currentCollection.mint(qty, { value: totalPrice });
        showToast("Minting sedang diproses...", "info");
        await tx.wait();

        showToast("Berhasil Mint NFT!", "success");
        loadCollection(currentCollection.target);
    } catch (error) {
        console.error(error);
        showToast("Mint Gagal: " + (error.reason || error.message), "error");
    }
}

async function handleFreeze() {
    if (!currentCollection) return;
    if (!confirm("PERINGATAN: Tindakan ini permanen. Lanjutkan?")) return;

    try {
        const tx = await currentCollection.freezeMetadata();
        showToast("Membekukan metadata...", "info");
        await tx.wait();
        showToast("Metadata BERHASIL DIBEKUKAN PERMANEN", "success");
        loadCollection(currentCollection.target);
    } catch (error) {
        console.error(error);
        showToast("Gagal freeze: " + (error.reason || error.message), "error");
    }
}

// --- Utilities ---
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function showToast(message, type = 'info', actionLink = null) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.style.cssText = `
        background: ${type === 'error' ? 'rgba(239, 68, 68, 0.9)' : type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(59, 130, 246, 0.9)'};
        color: white;
        padding: 1rem 1.5rem;
        margin-top: 1rem;
        border-radius: 12px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.2);
        animation: fadeIn 0.3s ease-out;
        backdrop-filter: blur(8px);
        font-weight: 500;
        border: 1px solid rgba(255,255,255,0.1);
        display: flex; flex-direction: column; gap: 0.5rem;
    `;

    const msgSpan = document.createElement('span');
    msgSpan.innerText = message;
    toast.appendChild(msgSpan);

    if (actionLink) {
        const link = document.createElement('a');
        link.href = actionLink.url;
        link.innerText = actionLink.text;
        link.target = "_blank";
        link.style.cssText = "color: white; text-decoration: underline; font-weight: bold; font-size: 0.9rem;";
        toast.appendChild(link);
    }

    ui.toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 8000); // Longer timeout
}

// --- Verification Logic ---
async function verifyProxy(proxyAddress) {
    console.log("Auto-verify skipped (API V2 require migration).");

    // Direct Manual Link (Best Reliability)
    const explorerUrl = CONFIG.NETWORKS[chainId].explorer;
    const verifyLink = `${explorerUrl}/proxyContractChecker?a=${proxyAddress}`;

    showToast("Klik untuk Verifikasi Contract (Manual)", "success", {
        text: "👉 Verifikasi Proxy Sekarang",
        url: verifyLink
    });

    return true;
}

// Start
init();
