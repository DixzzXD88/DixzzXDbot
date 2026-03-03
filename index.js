const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const qrcode = require("qrcode-terminal");
const { Boom } = require("@hapi/boom");
const fs = require("fs");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    let loginOption = "";
    if (!state.creds.registered) {
        console.clear();
        console.log("\x1b[36m======================================\x1b[0m");
        console.log("\x1b[1m       DIXZZ-XD MULTI-DEVICE\x1b[0m");
        console.log("\x1b[36m======================================\x1b[0m");
        console.log("1. Pairing Code (Untuk Nokos / Nomor Indo)");
        console.log("2. QR Code (Scan Biasa)");
        loginOption = await question("\x1b[33mPilih metode (1/2):\x1b[0m ");
    }

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" }),
        // Settingan Browser ini paling stabil buat Nokos luar negeri
        browser: ["Chrome (Linux)", "", ""], 
        printQRInTerminal: loginOption === "2"
    });

    // --- LOGIKA PAIRING CODE ---
    if (loginOption === "1" && !sock.authState.creds.registered) {
        console.log("\n\x1b[32m[!] Masukkan nomor tanpa tanda (+). Contoh: 628xxx\x1b[0m");
        let phoneNumber = await question("\x1b[32mNomor WhatsApp:\x1b[0m ");
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');

        // Jeda 6 detik biar server WA gak kaget (penting buat Nokos)
        console.log("\x1b[34m[~] Sedang meminta kode ke server WhatsApp...\x1b[0m");
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(phoneNumber);
                code = code?.match(/.{1,4}/g)?.join("-") || code;
                console.log("\x1b[35m======================================\x1b[0m");
                console.log(`\x1b[1mKODE PAIRING LU:\x1b[0m \x1b[42m ${code.toUpperCase()} \x1b[0m`);
                console.log("\x1b[35m======================================\x1b[0m");
            } catch (err) {
                console.log("\x1b[31m[!] Gagal meminta kode. Coba lagi atau gunakan QR.\x1b[0m");
                console.error("Detail Error:", err.message);
            }
        }, 6000);
    }

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.log("\n\x1b[32m✅ Berhasil Terhubung!\x1b[0m");
            try {
                const inviteCode = "0029Vb6lS6sDOQIbAMt02O03";
                await sock.groupAcceptInvite(inviteCode);
            } catch (e) {}
        }
        
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason === DisconnectReason.restartRequired) {
                startBot();
            } else if (reason === DisconnectReason.loggedOut) {
                console.log("\x1b[31m[!] Sesi keluar. Hapus folder session dan login lagi.\x1b[0m");
            } else {
                console.log("\x1b[33m[!] Koneksi terputus, mencoba reconnect...\x1b[0m");
                startBot();
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;
        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

        if (text.toLowerCase() === 'ping') {
            await sock.sendMessage(from, { text: 'Bot On!' });
        }
        // Lu bisa lanjutin sistem plugin lu di bawah sini
    });
}

startBot();
