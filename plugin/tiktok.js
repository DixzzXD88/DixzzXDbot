const https = require('https');

module.exports = async function (sock, msg, args) {
  try {
    if (!args || !args.length) {
      return sock.sendMessage(
        msg.key.remoteJid,
        { text: "❌ Contoh: .tiktok https://vt.tiktok.com/ZSyaGFR7J/" },
        { quoted: msg }
      );
    }

    const tiktokUrl = args[0];
    const jid = msg.key.remoteJid;

    await sock.sendMessage(jid, {
      react: { text: "🔍", key: msg.key },
    });

    // Pakai https native module
    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(tiktokUrl)}`;
    
    const data = await new Promise((resolve, reject) => {
      https.get(apiUrl, (response) => {
        let data = '';

        response.on('data', (chunk) => {
          data += chunk;
        });

        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });

      }).on('error', (err) => {
        reject(err);
      });
    });

    if (data.code !== 0) {
      return sock.sendMessage(
        jid,
        { text: "❌ Gagal mengambil data dari API TikTok." },
        { quoted: msg }
      );
    }

    const { data: videoData } = data;
    const { title, music_info } = videoData;
    
    // Kirim video tanpa watermark
    if (videoData.play) {
      await sock.sendMessage(
        jid,
        {
          video: { url: videoData.play },
          caption: `🎥 ${title || "Video TikTok"}\n✅ Tanpa watermark\n\n🎵 Musik: ${music_info?.title || "Unknown"}`
        },
        { quoted: msg }
      );
    }

    // Kirim audio
    if (videoData.music) {
      await sock.sendMessage(
        jid,
        {
          audio: { url: videoData.music },
          mimetype: "audio/mpeg",
          ptt: false,
        },
        { quoted: msg }
      );
    }

    await sock.sendMessage(jid, {
      react: { text: "✅", key: msg.key },
    });

  } catch (err) {
    console.error("TikTok Plugin Error:", err);
    await sock.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Terjadi kesalahan saat mengunduh video TikTok." },
      { quoted: msg }
    );
  }
};
