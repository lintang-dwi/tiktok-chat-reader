import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const clientBuildPath = join(__dirname, '..', 'client', 'dist');
app.use(express.static(clientBuildPath));

let currentConnection = null;

app.post('/connect-tiktok', async (req, res) => {
  const { tiktokId } = req.body;
  if (!tiktokId) {
    return res.status(400).json({ message: 'tiktokId diperlukan' });
  }

  if (currentConnection) {
    console.log('Memutuskan koneksi sebelumnya...');
    try {
      await currentConnection.disconnect();
    } catch (error) {
      console.error('Gagal memutuskan koneksi sebelumnya:', error);
    }
    currentConnection = null;
  }

  console.log(`Menghubungkan ke TikTok ID: ${tiktokId}`);
  try {
    currentConnection = new TikTokLiveConnection(tiktokId, {
      enableExtendedGiftInfo: true,
    });

    currentConnection.on(WebcastEvent.CONNECTED, (state) => {
      console.log(`Terhubung ke room ID: ${state.roomId}`);
      io.emit('tiktokConnected', { message: `Terhubung ke Live: ${tiktokId}`, state });
    });

    currentConnection.on(WebcastEvent.DISCONNECTED, (reason) => {
      console.log('Terputus dari TikTok Live:', reason || '');
      io.emit('tiktokDisconnected', { message: 'Terputus dari TikTok Live' });
      currentConnection = null;
    });

    currentConnection.on(WebcastEvent.ERROR, (err) => {
      console.error('Kesalahan koneksi TikTok:', err);
      io.emit('tiktokError', { message: 'Kesalahan koneksi TikTok', error: err.toString() });
      if (currentConnection) {
        currentConnection.disconnect().catch((e) => console.error('Kesalahan saat disconnect setelah error:', e));
        currentConnection = null;
      }
    });

    currentConnection.on(WebcastEvent.CHAT, (data) => {
      console.log(`${data.user.uniqueId} (Nickname: ${data.user.nickname || data.user.uniqueId}): ${data.comment}`);
      io.emit('chatMessage', data);
    });

    currentConnection.on(WebcastEvent.GIFT, (data) => {
      const giftInfo = `${data.user.uniqueId} (Nickname: ${data.user.nickname || data.user.uniqueId}) mengirim ${data.giftName} x${data.repeatCount} (Total: ${data.diamondCount * data.repeatCount} koin)`;
      console.log(giftInfo);
      io.emit('giftMessage', { ...data, formattedMessage: giftInfo });
    });

    currentConnection.on(WebcastEvent.LIKE, (data) => {
      console.log(`${data.user.uniqueId} (Nickname: ${data.user.nickname || data.user.uniqueId}) menyukai live (${data.likeCount} suka, total: ${data.totalLikeCount})`);
      io.emit('likeMessage', data);
    });

    await currentConnection.connect();
    res.json({ message: `Proses koneksi ke ${tiktokId} dimulai.` });
  } catch (err) {
    console.error('Gagal membuat atau memulai koneksi TikTok:', err);
    res.status(500).json({ message: 'Gagal memulai koneksi TikTok', error: err.toString() });
    if (currentConnection) {
      currentConnection.disconnect().catch((e) => console.error('Kesalahan saat disconnect setelah gagal connect:', e));
      currentConnection = null;
    }
  }
});

app.post('/disconnect-tiktok', async (req, res) => {
  if (currentConnection) {
    try {
      await currentConnection.disconnect();
      res.json({ message: 'Koneksi TikTok berhasil diputuskan.' });
    } catch (error) {
      console.error('Gagal memutuskan koneksi TikTok:', error);
      res.status(500).json({ message: 'Gagal memutuskan koneksi TikTok', error: error.toString() });
    } finally {
      currentConnection = null;
    }
  } else {
    res.status(400).json({ message: 'Tidak ada koneksi TikTok yang aktif.' });
  }
});

io.on('connection', (socket) => {
  console.log('Pengguna terhubung via Socket.IO:', socket.id);
  socket.emit('status', 'Anda terhubung ke server chat reader.');
  socket.on('disconnect', () => {
    console.log('Pengguna terputus dari Socket.IO:', socket.id);
  });
});

app.get('*', (req, res) => {
  res.sendFile(join(clientBuildPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server berjalan di http://localhost:${PORT}`);
});
