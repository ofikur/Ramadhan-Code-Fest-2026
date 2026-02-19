# Panduan Setup & Deploy

**Author**: [zidanaetrna](https://github.com/zidanaetrna)

Panduan ini buat bantu kamu install ArcBase di laptop, setting frontend, sampe **cara deploy ke blockchain** (Base Sepolia / Mainnet).

---

## 1. Persiapan

Pastiin di laptop kamu udah ada ini:
-   [Node.js](https://nodejs.org/) (versi 18 ke atas ya)
-   [Git](https://git-scm.com/)

**Install Dependensi dulu:**
Buka terminal di folder project, terus ketik:
```bash
npm install
```

---

## 2. Bikin File Config (.env)

Kamu perlu bikin file `.env`. Isinya rahasia, jangan sampe kesebar.
Copy aja dari file `.env.example`, atau bikin file baru namanya `.env` terus isi kayak gini:

```ini
# .env

# Private Key wallet kamu. Inget, harus ada saldo ETH-nya (Base Sepolia / Mainnet)
# PENTING: Jangan ada "0x" di depannya, copas aja mentahannya.
# DAN JANGAN KASIH TAU SIAPA-SIAPA!
PRIVATE_KEY="masukkan_private_key_kamu_di_sini"

# URL RPC (Boleh kosong, Hardhat udah punya default)
BASE_SEPOLIA_RPC_URL="https://sepolia.base.org"

# API Key Basescan (Buat verifikasi contract biar centang hijau)
# Daftar gratis di: https://basescan.org/myapikey
BASESCAN_API_KEY="masukkan_api_key_basescan"
```

---

## 3. Cara Deploy ke Blockchain

Ini langkah buat masukin contract kamu ke jaringan **Base Sepolia (Testnet)**.

### Langkah 1: Cari ETH Gratisan (Testnet)
Buat transaksi, kamu butuh "gas" (ETH bohongan). Minta dulu di sini:
-   [Coinbase Faucet](https://www.coinbase.com/faucets/base-sepolia-eth)
-   [Alchemy Faucet](https://www.alchemy.com/faucets/base-sepolia)
-   [QuickNode Faucet](https://faucet.quicknode.com/base/sepolia)

### Langkah 2: Jalanin Script Deploy
Ketik perintah ini di terminal:

```bash
npx hardhat run scripts/deploy.ts --network baseSepolia
```

Kalau sukses, nanti muncul tulisan kayak gini:
```text
Deploying contracts with the account: 0xWalletKamu...
...
Deployment Complete!
----------------------------------------------------
Factory Address: 0xAlamatFactory...
Collection Implementation: 0xAlamatImpl...
----------------------------------------------------
```
**Simpen dua alamat itu!** Jangan ilang.

### Langkah 3: Verifikasi Contract (Basescan)
Biar kodingan kamu bisa dilihat orang (verified) di Basescan, jalanin perintah ini:

**Verifikasi Implementation:**
```bash
npx hardhat verify --network baseSepolia <ALAMAT_COLLECTION_IMPLEMENTATION>
```
*(Ganti `<ALAMAT_COLLECTION_IMPLEMENTATION>` sama alamat yang muncul tadi)*

---

## 4. Nyambungin ke Frontend

Abis deploy, kamu harus kasih tau Frontend alamat factory yang baru.

1.  Buka file `frontend/config.js`.
2.  Cari bagian `NETWORKS`.
3.  Update `factoryAddress` buat `84532` (Base Sepolia) pake alamat **Factory Address** yang baru kamu dapet tadi.

```javascript
// frontend/config.js
NETWORKS: {
    84532: {
        name: "Base Sepolia",
        // Ganti di sini:
        factoryAddress: "0xAlamat_Factory_Baru_Kamu" 
    },
    // ...
}
```

4.  **Update ABI (Wajib)**
    Setiap kali kamu ubah kodingan smart contract, jalanin ini biar frontend-nya ngerti fungsi barunya:
    ```bash
    npx hardhat run scripts/exportAbis.ts
    ```

---

## 5. Jalanin Frontend (di Laptop)

Frontend ArcBase ini **Vanilla JS** tapi pakai sistem *bundling* biar performanya kenceng (Minified).

### Step 1: Build Dulu (Wajib)
Sebelum jalanin, kamu harus compile codingan `src/` jadi satu file `bundle.min.js`.
```bash
node esbuild.build.js
```
*Kalau berhasil, bakal muncul `frontend/bundle.min.js`.*

### Step 2: Konfigurasi
Buka `frontend/config.js` dan isi `PROJECT_ID` WalletConnect kamu. File ini **TIDAK IKUT** di-minify biar kamu bisa ganti config tanpa harus build ulang.

### Step 3: Jalanin Local Server
1.  Install ekstensi **Live Server** di VS Code.
2.  Buka file `frontend/index.html`.
3.  Klik kanan -> **Open with Live Server**.

---

## 6. Cara Deploy ke Netlify (Gampang Banget)

Gak perlu setting `netlify.toml` atau build command aneh-aneh.

1.  Pastikan kamu sudah run **Step 1 (Build)** di atas.
2.  Buka dashboard [Netlify](https://app.netlify.com/).
3.  Pilih **"Add new site"** -> **"Deploy manually"**.
4.  **Drag & Drop** satu folder `frontend` ke kotak upload.
5.  Tunggu sebenatar... **BOOM!** Website kamu live.

*Tips: Jangan lupa set `NETWORKS` di `config.js` ke Mainnet kalau mau rilis beneran.*

---

## 7. Selesai!
Sekarang kamu punya NFT Launchpad sendiri di Base Sepolia.
-   Coba connect wallet.
-   Deploy koleksi baru.
-   Mint NFT-nya.
-   Coba fitur freeze.
