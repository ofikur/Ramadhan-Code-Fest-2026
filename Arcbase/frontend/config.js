export const CONFIG = {
    // WalletConnect Project ID (Dapatkan di https://cloud.walletconnect.com/)
    // WAJIB DIISI: Ganti string di bawah ini dengan Project ID kamu sendiri
    PROJECT_ID: "YOUR_PROJECT_ID",

    // Pinata API Key (JWT)
    // Buat di https://app.pinata.cloud/developers/keys
    // WAJIB DIISI: Ganti string di bawah ini dengan JWT Token kamu
    PINATA_JWT: "YOUR_PINATA_JWT",

    // Basescan API Key untuk Auto-Verify Proxy
    // GET FREE KEY: https://basescan.org/myapikey
    BASESCAN_API_KEY: "YOUR_BASESCAN_API_KEY",

    // Konfigurasi Jaringan
    NETWORKS: {
        84532: {
            name: "Base Sepolia",
            rpc: "https://sepolia.base.org",
            chainId: 84532,
            explorer: "https://sepolia.basescan.org",
            // Default: pake CA bawaan
            factoryAddress: "0x20A6ea701b62aC6c0c48B1971aF61883DFb3364b" // kalo mau deploy sendiri silahkan ganti ke CA kamu
        },
        8453: {
            name: "Base Mainnet",
            rpc: "https://mainnet.base.org",
            chainId: 8453,
            explorer: "https://basescan.org",
            // Default: pake CA bawaan
            factoryAddress: "0x90c771A0AE6573E9Ca6bA598a3207B0569010E48" // kalo mau deploy sendiri silahkan ganti ke CA kamu
        }
    },

    // Jaringan Default untuk Demo
    DEFAULT_CHAIN_ID: 84532
};
