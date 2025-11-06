const moment = require("moment-timezone")
require("moment/locale/id")
moment.locale("id")

module.exports = async (sock, msg, args, { isOwner }) => {
  try {
    const sender = msg.pushName || "User"
    const nomor = msg.key.remoteJid
      ? msg.key.remoteJid.split("@")[0]
      : "Tidak diketahui"

    await sock.sendMessage(msg.from, {
      react: { text: "✨", key: msg.key }
    })

    const tanggal = moment().tz("Asia/Jakarta").format("dddd, DD MMMM YYYY")
    const jam = moment().tz("Asia/Jakarta").hour()
    let emojiWaktu = "🕒"
    if (jam >= 5 && jam < 11) emojiWaktu = "🌅"
    else if (jam >= 11 && jam < 15) emojiWaktu = "☀️"
    else if (jam >= 15 && jam < 18) emojiWaktu = "🌇"
    else if (jam >= 18 && jam < 22) emojiWaktu = "🌌"

    const waktu = moment().tz("Asia/Jakarta").format("HH:mm") + " " + emojiWaktu

    const teks = `
=======『 Info Bot 』=======
  
ㄔ Nama: ${sender}
ㄔ Nomor: ${nomor}

ㄔ Halo kak: ${sender}
ㄔ Tanggal: ${tanggal}
ㄔ Waktu: ${waktu}

ㄔ Nama Bot: DixzzXD
ㄔ Language : JavaScript
ㄔ Type : Plugin
ㄔ Developer : Dixzz

╔──『 Maker 』
│ツ .qc
│ツ .iqc 
│ツ .qctweet
│ツ .qcfb
│ツ .brat
│ツ .bratv
╚─────────────☉
`

    await sock.sendMessage(
      msg.from,
      {
        image: { url: "https://files.catbox.moe/1fsgrj.jpg" },
        caption: teks
      },
      { quoted: msg }
    )

    await sock.sendMessage(msg.from, {
      react: { text: "✅", key: msg.key }
    })
  } catch (err) {
    console.error("❌ Error di plugin makermenu:", err)
    await sock.sendMessage(msg.from, { text: "❌ Terjadi error di plugin makermenu" }, { quoted: msg })
  }
}
