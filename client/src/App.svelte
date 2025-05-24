<!-- client/src/App.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import io from 'socket.io-client';

  let socket;
  let tiktokUsername = '';
  let messages = [];
  let statusMessage = 'Belum terhubung ke server.';
  let isConnectedToTikTok = false;
  let serverUrl = ''; // Akan diisi otomatis

  onMount(() => {
    // Otomatis deteksi URL server untuk Socket.IO
    // Untuk dev (Vite proxy), socket akan otomatis terhubung ke server Vite yg mem-proxy
    // Untuk production, socket akan terhubung ke origin yang sama
    serverUrl = window.location.origin;
    socket = io(serverUrl); // Jika tanpa proxy Vite & beda port, gunakan 'http://localhost:3000'

    socket.on('connect', () => {
      statusMessage = 'Terhubung ke server chat reader.';
    });

    socket.on('disconnect', () => {
      statusMessage = 'Terputus dari server chat reader.';
      isConnectedToTikTok = false;
    });

    socket.on('status', (msg) => {
      console.log('Status dari server:', msg);
    });

    socket.on('tiktokConnected', (data) => {
      statusMessage = data.message || 'Terhubung ke TikTok Live!';
      console.log('TikTok Connected Event:', data);
      isConnectedToTikTok = true;
      messages = []; // Bersihkan pesan lama saat koneksi baru
    });

    socket.on('tiktokDisconnected', (data) => {
      statusMessage = data.message || 'Terputus dari TikTok Live.';
      console.log('TikTok Disconnected Event:', data);
      isConnectedToTikTok = false;
    });

    socket.on('tiktokError', (data) => {
      statusMessage = `Error TikTok: ${data.message || 'Tidak diketahui'}`;
      console.error('TikTok Error Event:', data);
      isConnectedToTikTok = false;
    });

    socket.on('chatMessage', (data) => {
      // Batasi jumlah pesan untuk performa
      if (messages.length > 200) {
        messages = messages.slice(messages.length - 200);
      }
      messages = [...messages, { type: 'chat', ...data }];
    });

    socket.on('giftMessage', (data) => {
       if (messages.length > 200) {
        messages = messages.slice(messages.length - 200);
      }
      messages = [...messages, { type: 'gift', ...data }];
    });

    socket.on('likeMessage', (data) => {
       if (messages.length > 200) {
        messages = messages.slice(messages.length - 200);
      }
      // Tampilkan hanya jika ada perubahan signifikan atau batasi frekuensi
      // Untuk contoh ini, kita tampilkan saja
      messages = [...messages, { type: 'like', ...data }];
    });

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  });

  async function connectToTikTok() {
    if (!tiktokUsername.trim()) {
      alert('Masukkan TikTok Username/ID!');
      return;
    }
    statusMessage = `Menghubungkan ke ${tiktokUsername}...`;
    try {
      // Gunakan path relatif jika menggunakan proxy Vite, atau full URL jika tidak
      const response = await fetch(`/connect-tiktok`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tiktokId: tiktokUsername.trim() }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.message || 'Gagal mengirim permintaan koneksi.');
      }
      // statusMessage akan diupdate oleh event 'tiktokConnected' dari server
      console.log('Permintaan koneksi dikirim:', result.message);
    } catch (error) {
      statusMessage = `Error: ${error.message}`;
      console.error('Gagal menghubungkan:', error);
      isConnectedToTikTok = false;
    }
  }

  async function disconnectFromTikTok() {
    statusMessage = 'Memutuskan koneksi...';
    try {
      const response = await fetch(`/disconnect-tiktok`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      const result = await response.json();
       if (!response.ok) {
        throw new Error(result.message || 'Gagal mengirim permintaan diskoneksi.');
      }
      // statusMessage akan diupdate oleh event 'tiktokDisconnected'
      console.log('Permintaan diskoneksi dikirim:', result.message);
    } catch (error) {
      statusMessage = `Error: ${error.message}`;
      console.error('Gagal memutuskan koneksi:', error);
    }
  }

</script>

<main>
  <h1>TikTok Live Chat Reader</h1>
  <p>Status: <span class:connected={isConnectedToTikTok} class:disconnected={!isConnectedToTikTok}>{statusMessage}</span></p>

  <div class="controls">
    <input type="text" bind:value={tiktokUsername} placeholder="Masukkan TikTok Username (e.g., @namaakun)" />
    {#if !isConnectedToTikTok}
      <button on:click={connectToTikTok} disabled={isConnectedToTikTok}>Hubungkan</button>
    {:else}
      <button on:click={disconnectFromTikTok} disabled={!isConnectedToTikTok}>Putuskan</button>
    {/if}
  </div>

  <div class="chat-container">
    {#each messages as msg (msg.msgId || msg.uniqueId + msg.createTime + Math.random())}
      <div class="message">
        {#if msg.type === 'chat'}
          <img src={msg.profilePictureUrl} alt="avatar" class="avatar" width="24" height="24" loading="lazy"/>
          <strong>{msg.uniqueId}:</strong> {msg.comment}
        {:else if msg.type === 'gift'}
          <span class="gift">🎁 {msg.uniqueId} mengirim {msg.giftName} x{msg.repeatCount} ({msg.diamondCount * msg.repeatCount} koin)</span>
        {:else if msg.type === 'like'}
          <span class="like">❤️ {msg.uniqueId} menyukai ({msg.likeCount} suka)</span>
        {/if}
      </div>
    {/each}
  </div>
</main>

<style>
  main {
    font-family: Arial, sans-serif;
    max-width: 600px;
    margin: 20px auto;
    padding: 20px;
    border: 1px solid #ccc;
    border-radius: 8px;
  }
  h1 {
    text-align: center;
    color: #333;
  }
  .controls {
    display: flex;
    gap: 10px;
    margin-bottom: 20px;
  }
  input[type="text"] {
    flex-grow: 1;
    padding: 8px;
    border: 1px solid #ddd;
    border-radius: 4px;
  }
  button {
    padding: 8px 15px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  button:disabled {
    background-color: #ccc;
  }
  button:hover:not(:disabled) {
    background-color: #0056b3;
  }
  .chat-container {
    height: 400px;
    overflow-y: auto;
    border: 1px solid #eee;
    padding: 10px;
    background-color: #f9f9f9;
    border-radius: 4px;
  }
  .message {
    margin-bottom: 8px;
    padding: 5px;
    border-radius: 4px;
    background-color: white;
    word-wrap: break-word;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .avatar {
    border-radius: 50%;
    object-fit: cover;
  }
  .gift {
    color: #ffc107; /* Gold */
    font-style: italic;
  }
  .like {
    color: #e91e63; /* Pink */
    font-style: italic;
  }
  .status {
    font-weight: bold;
  }
  .connected { color: green; }
  .disconnected { color: red; }
</style>