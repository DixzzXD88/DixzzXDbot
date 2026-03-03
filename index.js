const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const readline = require("readline");
const { Boom } = require("@hapi/boom");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    // Tampilan Menu Awal (Cuma muncul kalau belum login)
    if (!state.creds.registered) {
        console.clear();
        console.log("\x1b[36m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m");
        console.log("\x1b[36m┃\x1b[0m \x1b[1m       DIXZZ-XD BOT CONNECT        \x1b[0m \x1b[36m┃\x1b[0m");
        console.log("\x1b[36m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m");
        console.log("\x1b[32m[1]\x1b[0m Pairing Code (Nokos/Indo)");
        console.log("\x1b[32m[2]\x1b[0m QR Code (Scan)");
        const pilih = await question("\n\x1b[33mPilih Metode Login: \x1b[0m");

        if (pilih === "1") {
            let nomor = await question("\x1b[32mMasukkan Nomor (Contoh: 584xxx): \x1b[0m");
            nomor = nomor.replace(/[^0-9]/g, '');
            
            const sock = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: "fatal" }),
                browser: ["Mac OS", "Chrome", "121.0.6167.160"]
            });

            setTimeout(async () => {
                try {
                    let code = await sock.requestPairingCode(nomor);
                    code = code?.match(/.{1,4}/g)?.join("-") || code;
                    console.clear();
                    console.log("\x1b[35m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m");
                    console.log(`\x1b[35m┃\x1b[0m KODE PAIRING: \x1b[1m\x1b[32m${code.toUpperCase()}\x1b[0m`);
                    console.log("\x1b[35m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m");
                    console.log("\x1b[33m[!] Masukkan kode di atas ke WA HP Lu.\x1b[0m");
                } catch (e) {
                    console.log("Gagal minta kode: " + e.message);
                }
            }, 3000);
        }
    }

    const sock = makeWASocket({
        version,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })),
        },
        logger: pino({ level: "fatal" }),
        browser: ["Mac OS", "Chrome", "121.0.6167.160"],
        printQRInTerminal: true
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === "open") {
            console.clear();
            console.log("\x1b[32m┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓\x1b[0m");
            console.log("\x1b[32m┃\x1b[0m    BOT BERHASIL TERHUBUNG!       \x1b[32m┃\x1b[0m");
            console.log("\x1b[32m┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛\x1b[0m");
            console.log(`User: ${sock.user.id.split(':')[0]}`);
            try {
                await sock.groupAcceptInvite("0029Vb6lS6sDOQIbAMt02O03");
            } catch (e) {}
        }
        
        if (connection === "close") {
            let reason = new Boom(lastDisconnect?.error)?.output.statusCode;
            if (reason !== DisconnectReason.loggedOut) {
                startBot();
            }
        }
    });

    // Handle Pesan Masuk (Tampilan Rapi)
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0];
        if (!m.message || m.key.fromMe) return;

        const from = m.key.remoteJid;
        const name = m.pushName || "User";
        const body = m.message.conversation || m.message.extendedTextMessage?.text || "Bukan Teks";

        // LOG PESAN YANG RAPI
        console.log(`\x1b[36m[ MESSAGE ]\x1b[0m \x1b[1m${name}\x1b[0m: ${body}`);

        // Respon sederhana
        if (body.toLowerCase() === '.ping') {
            await sock.sendMessage(from, { text: 'Bot Aktif, Cok! 🚀' }, { quoted: m });
        }
    });
}

// Jalankan
startBot();
