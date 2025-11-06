const fs = require("fs")
const path = require("path")
const moment = require("moment-timezone")
require("moment/locale/id")
moment.locale("id")

module.exports = async function (sock, msg, args) {
  try {
    const sender = msg.pushName || "User"
    const from = msg.key.remoteJid
    const nomor = from ? from.split("@")[0] : "Tidak diketahui"

    await sock.sendMessage(from, {
      react: { text: "✍️", key: msg.key }
    })

    const imagePath = path.join(__dirname, "../trd.png")
    const buffer = fs.readFileSync(imagePath)

    const jam = moment().tz("Asia/Jakarta").hour()
    let emojiWaktu = "🕒"
    if (jam >= 5 && jam < 11) emojiWaktu = "🌅"
    else if (jam >= 11 && jam < 15) emojiWaktu = "☀️"
    else if (jam >= 15 && jam < 18) emojiWaktu = "🌇"
    else emojiWaktu = "🌌"

    const waktu = moment().tz("Asia/Jakarta").format("HH:mm") + " " + emojiWaktu

    const caption = `
Halo kak, selamat datang di *DixzzXD*  

Bot ini dibuat untuk membantu aktivitas kamu dengan fitur-fitur sederhana namun bermanfaat.  
Semoga dengan adanya bot ini, kamu bisa lebih mudah mencari informasi, hiburan, maupun tools praktis yang tersedia di dalamnya.  

╔──『 Thanks To 』
│> Chat GPT
│> Xvoid
│> Siputzx
│> Sxtream
│> Allah Swt (My God)
╚─────────────☉

╔──『 ALL MENU 』
│ツ .aimenu
│ツ .makermenu
│ツ .randommenu
│ツ .primbonmenu
╚─────────────☉
`

    await sock.sendMessage(
      from,
      {
        image: buffer,
        caption: caption,
        footer: "DixzzXD © 2025"
      },
      { quoted: msg }
    )

    await sock.sendMessage(from, {
      react: { text: "📃", key: msg.key }
    })
  } catch (err) {
    console.error("Error di plugin menu:", err)
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Terjadi error di plugin menu" },
      { quoted: msg }
    )
  }
}
