const { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const P = require("pino");
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
    console.log('🚀 Starting bot...');
    
    // Input nomor manual
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    const phoneNumber = await new Promise((resolve) => {
        rl.question('📱 Masukin nomor bot (contoh: 62812xxxxxxx): ', (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });

    console.log('📞 Using number:', phoneNumber);

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    console.log('🔧 Creating connection...');

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        browser: ["Ditzmd", "Chrome", "1.0.0"],
        printQRInTerminal: false,
        pairingOptions: {
            usePairingCode: true,
            phoneNumber: phoneNumber
        }
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, qr, pairingCode } = update;
        console.log('🔄 Connection update:', connection);
        
        if (pairingCode) {
            console.log('══════════════════════════════════════');
            console.log(`🚀 PAIRING CODE: ${pairingCode}`);
            console.log('══════════════════════════════════════');
            console.log('Cara pake:');
            console.log('1. Buka WhatsApp di HP');
            console.log('2. Tap 3 titik > Linked Devices > Link Device');
            console.log('3. Masukin code di atas');
            console.log('══════════════════════════════════════');
        }
        
        if (connection === "open") {
            console.log("✅ Bot connected!");
        }
        
        if (connection === "close") {
            console.log("❌ Connection closed, restarting...");
            setTimeout(() => startBot(), 5000);
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
                await sock.sendMessage(from, { text: "⚠️ Error di plugin" });
            }
        }
    });
}

// Jalankan bot
loadPlugins();
watchPlugins();
startBot().catch(console.error);
