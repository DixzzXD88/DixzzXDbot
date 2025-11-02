require('./settings');
const fs = require('fs');
const pino = require('pino');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');
const { exec } = require('child_process');
const { Boom } = require('@hapi/boom');
const { default: WAConnection, useMultiFileAuthState, Browsers, DisconnectReason, makeInMemoryStore, makeCacheableSignalKeyStore, fetchLatestWaWebVersion, PHONENUMBER_MCC } = require('@whiskeysockets/baileys');

const pairingCode = true; // PAKAI PAIRING CODE SELALU
const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const store = makeInMemoryStore({ logger: pino().child({ level: 'silent', stream: 'store' }) })
const question = (text) => new Promise((resolve) => rl.question(text, resolve))

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
    const { state, saveCreds } = await useMultiFileAuthState('./session'); // SESUAI SESSION LU
    const { version, isLatest } = await fetchLatestWaWebVersion();
    
    const getMessage = async (key) => {
        if (store) {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg?.message || ''
        }
        return {
            conversation: 'Halo Saya Bot'
        }
    }
    
    const sock = WAConnection({
        isLatest,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // QR DIMATIKAN
        browser: Browsers.ubuntu('Chrome'),
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
        },
        getMessage,
        syncFullHistory: true,
        generateHighQualityLinkPreview: true,
    })

    // PAIRING CODE SYSTEM
    if (pairingCode && !sock.authState.creds.registered) {
        let phoneNumber;
        async function getPhoneNumber() {
            phoneNumber = await question('📱 Masukin nomor bot (62812xxxxxxx): ');
            phoneNumber = phoneNumber.replace(/[^0-9]/g, '')
            
            if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v)) && !phoneNumber.length < 6) {
                console.log(chalk.bgBlack(chalk.redBright('Start with your Country WhatsApp code') + chalk.whiteBright(',') + chalk.greenBright(' Example : 62xxx')));
                await getPhoneNumber()
            }
        }
        
        setTimeout(async () => {
            await getPhoneNumber()
            let code = await sock.requestPairingCode(phoneNumber);
            console.log('\n══════════════════════════════════════');
            console.log(`🚀 PAIRING CODE: ${code}`);
            console.log('══════════════════════════════════════');
            console.log('1. Buka WhatsApp > Linked Devices > Link Device');
            console.log('2. Masukin code di atas');
            console.log('══════════════════════════════════════\n');
        }, 3000)
    }

    store.bind(sock.ev)
    
    sock.ev.on('creds.update', saveCreds)
    
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update
        if (connection === 'close') {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason === DisconnectReason.connectionLost || 
                reason === DisconnectReason.connectionClosed ||
                reason === DisconnectReason.restartRequired ||
                reason === DisconnectReason.timedOut) {
                console.log('❌ Connection lost, restarting...');
                startBot()
            } else if (reason === DisconnectReason.loggedOut) {
                console.log('❌ Logged out, delete session...');
                exec('rm -rf ./session/*')
                process.exit(1)
            } else {
                console.log(`❌ Unknown error: ${reason}`);
                startBot()
            }
        }
        if (connection == 'open') {
            console.log('✅ Bot connected successfully!');
        }
    });

    // MESSAGE HANDLER - PAKE SYSTEM LU
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

// JALANKAN
loadPlugins();
watchPlugins();
startBot().catch(console.error);
