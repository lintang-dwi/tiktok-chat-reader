import './app.css' // Jika ada file CSS global
import App from './App.svelte'

const app = new App({
  target: document.getElementById('app'),
})

export default app