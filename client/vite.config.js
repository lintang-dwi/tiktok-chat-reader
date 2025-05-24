// client/vite.config.js
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    // Jika Anda menjalankan server Express di port yang berbeda saat development
    // dan ingin menghindari masalah CORS, Anda bisa menggunakan proxy.
    // Jika server Express dan Vite dev server berjalan di port yang sama (misal Express serve static Vite build)
    // ini mungkin tidak diperlukan.
    proxy: {
      '/socket.io': { // Proxy permintaan Socket.IO
        target: 'http://localhost:3000', // Sesuaikan dengan port server Express Anda
        ws: true, // Penting untuk WebSocket
      },
      '/connect-tiktok': { // Proxy API endpoint
         target: 'http://localhost:3000',
      },
      '/disconnect-tiktok': { // Proxy API endpoint
         target: 'http://localhost:3000',
      }
    }
  },
  build: {
    outDir: 'dist' // Pastikan ini sesuai dengan path di server.js
  }
})  