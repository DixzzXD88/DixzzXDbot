import { makeWASocket, useMultiFileAuthState } from "@whiskeysockets/baileys"
import qrcode from "qrcode-terminal"
import readline from "readline"

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState("session")
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ["DixzzXD", "Chrome", "1.0"]
  })

  sock.ev.on("creds.update", saveCreds)

  rl.question("\nPilih metode login:\n1. QR Code\n2. Pairing Code\n> ", async (choice) => {
    if (choice === "1") {
      console.log("\n🔑 Scan QR berikut di WhatsApp Web:")
      sock.ev.on("connection.update", ({ qr }) => {
        if (qr) qrcode.generate(qr, { small: true })
      })
    } else if (choice === "2") {
      rl.question("\nMasukkan nomor WhatsApp (contoh 62812xxxx): ", async (number) => {
        if (!number) {
          console.log("❌ Nomor tidak boleh kosong!")
          rl.close()
          process.exit(1)
        }
        sock.ev.on('connection.update', async (update) => {
  const { connection } = update
  if (connection === 'open') {
    console.log('✅ Tersambung ke server WhatsApp, siap request code!')
    const code = await sock.requestPairingCode(number)
    console.log(`\n🔑 Pairing Code: ${code}\n`)
  } else if (connection === 'close') {
    console.log('❌ Koneksi terputus, coba lagi nanti...')
  }
})
        rl.close()
      })
    } else {
      console.log("❌ Pilihan tidak valid!")
      rl.close()
    }
  })

  sock.ev.on("connection.update", (update) => {
    const { connection } = update
    if (connection === "open") console.log("✅ Bot berhasil konek ke WhatsApp!")
    else if (connection === "close") console.log("❌ Koneksi terputus, mencoba ulang...")
  })
}

startBot()
