<template>
  <div class="camouflage-503-wrapper">
    <div class="content-box">
      <h1>503 Service Temporarily Unavailable</h1>
      <p>The server is currently unable to handle the request due to maintenance downtime or capacity problems. Please try again later.</p>
      <hr />
      <div class="footer-info">nginx/1.24.0 (Ubuntu)</div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import { useVaultStore } from '../stores/vaultStore'

// Pure camouflage mode - no secret triggers, no links, strictly realistic server error
const store = useVaultStore()
let pollTimer = null

onMounted(() => {
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/auth/status')
      if (res.status === 200) {
        store.checkStatus()
      }
    } catch {
      // Still 503 or network issue
    }
  }, 5000)
})

onUnmounted(() => {
  if (pollTimer) clearInterval(pollTimer)
})
</script>

<style scoped>
.camouflage-503-wrapper {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #ffffff;
  color: #222222;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
  z-index: 9999999;
  display: flex;
  justify-content: center;
  padding-top: 80px;
}

.content-box {
  width: 100%;
  max-width: 48em;
  padding: 0 20px;
}

h1 {
  font-size: 26px;
  font-weight: 500;
  margin: 0 0 10px 0;
  color: #111111;
}

p {
  font-size: 14px;
  line-height: 1.6;
  color: #444444;
  margin: 0 0 16px 0;
}

hr {
  border: 0;
  height: 1px;
  background: #e2e8f0;
  margin: 24px 0 16px 0;
}

.footer-info {
  font-size: 13px;
  color: #718096;
  font-style: italic;
}
</style>
