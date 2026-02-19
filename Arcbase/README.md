# ArcBase Protocol

**Author**: [zidanaetrna](https://github.com/zidanaetrna)

# ArcBase - NFT Launchpad Protocol

ArcBase is a decentralized NFT launchpad built on **Base Network**. It allows creators to deploy gas-efficient, upgradeable NFT collections without writing code.

![ArcBase Banner](https://via.placeholder.com/800x200?text=ArcBase+Protocol)

## 🚀 Key Features

*   **Gas Efficient**: Uses **ERC-721A** + **Minimal Proxy (Clones)** pattern to minimize deployment costs (< $2).
*   **No-Code Deployment**: Deploy contracts directly from the UI.
*   **IPFS Integration**: Auto-upload images and metadata to IPFS via Pinata.
*   **Upgradeable**: Contracts use UUPS standard, allowing future upgrades (if not frozen).
*   **Shareable Mint Links**: Creators can share a link `?address=0x...` for others to mint.
*   **Auto-Verify**: Integrated manual and auto-verification flows for BaseScan.

## 📚 Documentation

*   **[Setup Guide](./SETUP_GUIDE.md)**: How to run the project locally.
*   **[Architecture Diagram](https://mermaid-ai-editor.com/shared/ac29712e-2f14-4ad0-81ed-e0b890f53f34)**: Logic flow and component interaction.
*   **[Smart Contracts](./contracts/)**: Solidity source code.

## 🛠 Tech Stack

*   **Frontend**: Native JS, Lit-HTML, AppKit (Reown).
*   **Blockchain**: Base Sepolia (Testnet) / Base Mainnet.
*   **Storage**: IPFS (Pinata).
*   **Tooling**: Hardhat, Ethers.js v6.

## 🏃‍♂️ Quick Start

1.  Install dependencies: `npm install`
2.  Configure `.env` (see `.env.example`).
3.  **Build Frontend**: `node esbuild.build.js` (Wajib! Buat generate `bundle.min.js`)
4.  Open `frontend/index.html` with Live Server.

## 🌐 Deploy to Netlify (Production)

1.  Pastikan sudah run `node esbuild.build.js`.
2.  Buka [Netlify Drop](https://app.netlify.com/drop).
3.  **Drag & Drop** folder `frontend` (folder-nya aja) ke sana.
4.  Selesai! Web langsung live.

## 📂 Struktur Folder Baru

*   `frontend/`: Folder siap deploy (Distribution).
    *   `index.html`, `style.css`, `config.js`, `bundle.min.js`.
*   `frontend/src/`: Source code asli (Development).
    *   `app.js`, `abis.js`, `libs/`.

## 🔗 Share Your Collection

To let others mint your NFT, simple share the link:
`https://your-website.com/?address=YOUR_CONTRACT_ADDRESS`

## 📜 Deployed Contracts

| Network | Contract | Address |
| :--- | :--- | :--- |
| **Base Sepolia** | Factory | `0x20A6ea701b62aC6c0c48B1971aF61883DFb3364b` |
| **Base Sepolia** | Collection Impl | `0x221B26cac4F0eAE10F7dbf68C681d7585a5b35BC` |
| **Base Mainnet** | Factory | `0x90c771A0AE6573E9Ca6bA598a3207B0569010E48` |
| **Base Mainnet** | Collection Impl | `0x96d802Cdc04959AA7c7e4234b3615bE2A7eaAd59` |

### Live Demo
**UNOFFICIAL NFT IMPHNEN** (Live di Base Mainnet):  
[https://basescan.org/address/0x69fdb11e74caf09d7380016cfb8b1c920f55bc75](https://basescan.org/address/0x69fdb11e74caf09d7380016cfb8b1c920f55bc75)

**Frontend Demo**:  
[https://arc-base.netlify.app](https://arc-base.netlify.app)

---
*Built for Ramadhan Code Fest 2026*

## Teknologi

-   **Smart Contracts**: Solidity, Hardhat, OpenZeppelin.
-   **Frontend**: Vanilla HTML/JS/CSS, Ethers.js v6.
-   **Koneksi**: WalletConnect v2 (Bisa connect ke banyak wallet).
-   **Testing**: Chai & Hardhat Ethers (Test coverage 100%, aman bos).

## Dokumentasi

Dokumentasinya dipisah biar enak bacanya:

-   **[Panduan Setup & Deploy](SETUP_GUIDE.md)**: Buat kamu yang mau install, jalanin frontend, atau deploy ke blockchain. (**Mulai dari sini**)
-   **[Arsitektur Teknis](ARCHITECTURE.md)**: Buat yang kepo sama kodingan smart contract, sistem keamanan, sama cara hemat gas-nya.

## Quick Start (Lokal)

1.  **Install Dulu**: `npm install`
2.  **Setup Env**: Copy file `.env.example` rename jadi `.env`
3.  **Jalanin Demo**: Buka folder `frontend` pake Live Server di VS Code.

*(Cek [SETUP_GUIDE.md](SETUP_GUIDE.md) buat langkah lengkapnya)*

## Lisensi

**MIT License**. Kode ini *open-source*. Pake aja bebas, modif sesuka hati.
