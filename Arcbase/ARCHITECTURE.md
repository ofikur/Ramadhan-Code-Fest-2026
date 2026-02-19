# Arsitektur Teknis ArcBase

**Author**: [zidanaetrna](https://github.com/zidanaetrna)

Dokumen ini isinya detail teknis soal gimana ArcBase bekerja di belakang layar.

## 1. Komponen Smart Contract

### ArcBaseFactory.sol (Upgradeable)
Ini contract pabriknya. Tugasnya cuma satu: (deploy) contract koleksi NFT baru.
-   **Pola Upgrade**: UUPS.
-   **Cara Deploy**: Pake `CREATE2`. Ini trik biar alamat contract barunya bisa diprediksi.
    -   Rumusnya: `keccak256(0xff ++ factoryAddress ++ salt ++ keccak256(bytecode))`
    -   `salt`-nya campuran dari: wallet kamu, nama koleksi, sama chain ID.
-   **Registry**: Dia nyatet semua koleksi yang udah dideploy, jadi ketahuan mana yang asli mana yang palsu.

### ArcBaseCollection.sol (Upgradeable UUPS)
Ini contract NFT-nya. Isinya logika ERC721A yang udah dioptimasi.
-   **Dasarnya**: `ERC721A-Upgradeable` + `OwnableUpgradeable` + `UUPSUpgradeable`.
-   **Keamanan**:
    -   `ReentrancyGuardUpgradeable`: Biar gak bisa diserang pake teknik reentrancy pas minting atau withdraw duit.
    -   `EIP-712`: Standar tanda tangan digital buat whitelist. Jadi user whitelist tinggal tanda tangan offline, gak perlu bayar gas buat masukin data ke contract.

---

## 2. Model Keamanan & Lifecycle

Di sini gweh pake pendekatan **"Trust-then-Freeze"**.

### Fase 1: Masih Bisa Diubah (Mutable)
Pas baru dideploy, contract ini masih fleksibel:
-   **Logika Contract**: Masih bisa di-upgrade kalau nemu bug.
-   **Metadata**: Link gambar (Base URI) masih bisa diganti (misal mau reveal gambar).
-   **Royalti**: Masih bisa disetting ulang.

### Fase 2: Dibekukan (Frozen)
Kalau semuanya udah oke, kamu (sebagai creator) bisa panggil fungsi `freezeMetadata()`. Inget, ini **PERMANEN**.
-   **Upgrade Mati**: Fungsi `_authorizeUpgrade` bakal error terus. Jadi contract gak bisa diubah lagi selamanya.
-   **Metadata Mati**: Base URI gak bisa diganti lagi.
-   **Royalti Mati**: Fee royalti kekunci.

**Soal Storage:**
Contract ini udah disiapin slot kosong (`__gap`) di memorinya. Jadi kalaupun ada upgrade di masa depan (sebelum freeze), datanya gak bakal tabrakan/corrupt.

---

## 3. Cara Bagi Duit (Revenue Split)

Duit hasil minting **GAK LANGSUNG** dikirim ke wallet kamu. Kenapa? Karena kalau dikirim otomatis (Push), terus salah satu penerima wallet-nya error (misal smart contract yang nolak ETH), transaksi minting orang lain bakal gagal semua.

Jadi, solusinya pake **Pull Payment**:
1.  Duit ngumpul dulu di contract.
2.  Kamu (dan shareholder lain) tinggal panggil fungsi `withdraw()`.
3.  Contract bakal ngecek jatah kamu berapa, terus transfer deh.

---

## 4. Optimasi Gas (Biar Murah)

Contract ini didesain biar hemat gas pas jalan di Base L2:

-   **Batch Minting**: Minting 5 NFT sekaligus biayanya beda tipis sama minting 1. Makasih `ERC721A`.
-   **Custom Errors**: Gak pake `require(..., "Pesan Error Panjang")`, tapi pake `error Name()`. Lebih hemat pas deploy dan pas error.
-   **Packed Storage**: Variable yang kecil-kecil digabungin jadi satu slot memori. Contoh: fee royalti sama alamat penerima digabung jadi satu baris data (`uint256`).
-   **Unchecked Blocks**: Matematika yang udah pasti aman (gak mungkin minus/berlebih), gak perlu dicek ulang sama sistem. Lumayan hemat dikit.

---

## 6. Arsitektur Frontend (Client-Side)

ArcBase sengaja gak pake framework berat kayak React/Next.js biar:
1.  **Decentralized Friendly**: Bisa di-host di IPFS/Arweave dengan mudah (karena cuma static HTML/JS).
2.  **Ringan**: Gak perlu download bundle React 2MB cuma buat minting NFT.

### Bundling Strategy
Kita pake **esbuild** buat gabungin kode:
*   **Source**: `frontend/src/` (Code yang kamu edit).
*   **Output**: `frontend/bundle.min.js` (Code yang dibaca browser).
*   **Config**: `frontend/config.js` dibiarin terpisah biar user bisa ganti RPC/API Key tanpa harus ngerti cara build ulang (User-Friendly).

Ini nyampur performa "Modern Web" (Bundling via esbuild) sama kemudahan "Old School Web" (Config via file JS biasa).
