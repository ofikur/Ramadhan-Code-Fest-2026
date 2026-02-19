# ArcBase Frontend

Web interface simple buat berinteraksi dengan protokol ArcBase. Gak perlu build step ribet, cukup pake Vanilla JS + AppKit.

## Cara Jalanin (Local)

1.  Pastikan sudah `npm install` di root folder.
2.  Build bundle AppKit (sekali aja):
    ```bash
    node esbuild.build.js
    ```
3.  Buka `index.html` pake **Live Server** (Extension VS Code) atau browser biasa.

## Struktur File

*   `index.html`: Layout utama UI (Menggunakan `bundle.min.js`).
*   `bundle.min.js`: File logika utama yang sudah di-minify & bundle (Production ready).
*   `config.js`: Konfigurasi Address Factory & API Keys (User editable).
*   `style.css`: Styling (CSS).
*   `src/`: Source code (untuk development).
    *   `app.js`: Logika utama source.
    *   `abis.js`: ABI Contracts.
    *   `libs/`: Library tambahan.

## Fitur UI

1.  **Connect Wallet**: Pojok kanan atas. Support MetaMask, WalletConnect, dll.
2.  **Deploy Collection**:
    *   Isi Nama, Simbol, Supply, Harga.
    *   Upload gambar cover (otomatis ke IPFS via Pinata).
    *   Klik Deploy -> Confirm di Wallet.
3.  **Manage Collection**:
    *   Paste address collection di form bawah buat load datanya.
    *   Bisa **Mint** (User) atau **Freeze Metadata** (Owner).
4.  **Auto Verify**:
    *   Setelah deploy, sistem bakal coba verifikasi contract otomatis.
    *   Kalau gagal, muncul link manual ke BaseScan.

## Deployment ke Production

Kalau mau host di Vercel/Netlify:
1.  Upload folder `frontend` ini (plus `esbuild.build.js` & `package.json` kalau butuh build di server).
2.  Atau, build dulu `bundle-appkit.js` di lokal, terus upload file statisnya aja (`index.html`, `app.js`, `config.js`, `style.css`, `bundle-appkit.js`).