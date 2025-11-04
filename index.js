const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

let plugins = {}

function loadPlugins() {
    const pluginPath = path.join(__dirname, "plugin");
    fs.readdirSync(pluginPath).forEach(file => {
        if (file.endsWith(".js")) {
            const pluginName = file.replace(".js", "");
            delete require.cache[require.resolve(`./plugin/${file}`)];
            plugins[pluginName] = require(`./plugin/${file}`);
            console.log(`✅ Plugin loaded: ${pluginName}`);
        }
    });
}

function watchPlugins() {
    const pluginPath = path.join(__dirname, "plugin");
    fs.watch(pluginPath, (eventType, filename) => {
        if (filename && filename.endsWith(".js")) {
            try {
                const pluginName = filename.replace(".js", "");
                delete require.cache[require.resolve(`./plugin/${filename}`)];
                plugins[pluginName] = require(`./plugin/${filename}`);
                console.log(`♻️ Plugin reloaded: ${pluginName}`);
            } catch (err) {
                console.error(`❌ Gagal reload plugin ${filename}:`, err);
            }
        }
    });
}

function getQuotedRaw(msg) {
    let quotedMsg = null;
    for (const k of Object.keys(msg.message)) {
        const m = msg.message[k];
        if (m?.contextInfo?.quotedMessage) {
            quotedMsg = m.contextInfo.quotedMessage;
            break;
        }
    }
    if (!quotedMsg && msg.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        quotedMsg = msg.message.extendedTextMessage.contextInfo.quotedMessage;
    }
    return quotedMsg;
}

async function startBot() {
    // 🔥 Tampilkan ASCII art dulu
    try {
        const asciiArt = fs.readFileSync(path.join(__dirname, "ascii.txt"), "utf8");
        console.log(asciiArt);
    } catch {
        console.log("⚠️ Gagal menampilkan ASCII (file ascii.txt tidak ditemukan)");
    }

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        browser: ["DixzzXD", "Chrome", "1.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;
        if (qr) {
            console.log("🔑 Scan QR ini di WhatsApp Web:");
            qrcode.generate(qr, { small: true });
        }
        if (connection === "open") {
            console.log("✅ DixzzXD berhasil konek ke WhatsApp!");
        }
        if (connection === "close") {
            console.log("❌ Koneksi terputus, mencoba reconnect...");
            startBot();
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];
        if (!msg.message || !msg.key.remoteJid) return;

        const from = msg.key.remoteJid;
        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption ||
            "";

        const wrapper = {
            ...msg,
            from,
            text,
            quoted: getQuotedRaw(msg)
        };

        if (!text.startsWith(".")) return;

        const args = text.slice(1).trim().split(/ +/);
        const command = args.shift().toLowerCase();

        if (plugins[command]) {
            try {
                await plugins[command](sock, wrapper, args, {
                    isOwner: msg.key.fromMe
                });
            } catch (e) {
                console.error(`❌ Error di plugin ${command}:`, e);
                await sock.sendMessage(from, { text: "⚠️ Terjadi error di plugin" });
            }
        }
    });
}

loadPlugins();
watchPlugins();
startBot();
