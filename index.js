async function startBot() {
    console.log('🚀 Starting bot...');
    
    const readline = require('readline');
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    // PILIH METODE KONEKSI
    const connectionMethod = await new Promise((resolve) => {
        console.log('\n🎯 Pilih cara koneksi:');
        console.log('1. Pairing Code (6 digit)');
        console.log('2. QR Code');
        rl.question('Pilih (1/2): ', (answer) => {
            resolve(answer.trim());
        });
    });

    let phoneNumber;
    if (connectionMethod === '1') {
        phoneNumber = await new Promise((resolve) => {
            rl.question('📱 Masukin nomor bot (contoh: 62812xxxxxxx): ', (answer) => {
                resolve(answer.trim());
            });
        });
    } else {
        rl.close();
    }

    const { state, saveCreds } = await useMultiFileAuthState("./session");
    const { version } = await fetchLatestBaileysVersion();

    console.log('🔧 Creating connection...');

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" }),
        browser: ["Ditzmd", "Chrome", "1.0.0"],
        // PAIRING CODE KALO DIPILIH
        ...(connectionMethod === '1' && {
            pairingOptions: {
                usePairingCode: true,
                phoneNumber: phoneNumber
            },
            printQRInTerminal: false
        }),
        // QR CODE KALO DIPILIH  
        ...(connectionMethod === '2' && {
            printQRInTerminal: true
        })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {
        const { connection, qr, pairingCode } = update;
        
        if (connectionMethod === '1' && pairingCode) {
            console.log('\n══════════════════════════════════════');
            console.log(`🚀 PAIRING CODE: ${pairingCode}`);
            console.log('══════════════════════════════════════');
            console.log('Cara pake:');
            console.log('1. Buka WhatsApp di HP');
            console.log('2. Tap 3 titik > Linked Devices > Link Device');
            console.log('3. Masukin code di atas');
            console.log('══════════════════════════════════════\n');
        }
        // QR code otomatis muncul kalo pilih metode 2
        
        if (connection === "open") {
            console.log("✅ Bot connected successfully!");
        }
        
        if (connection === "close") {
            console.log("❌ Connection closed, restarting...");
            setTimeout(() => startBot(), 5000);
        }
    });

    // ... sisanya tetap
}
