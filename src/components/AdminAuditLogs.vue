<template>
  <div class="logs">
    <div class="toolbar">
      <p class="lead">Sign-ins, client details and blocked attempts.</p>
      <div class="tb-actions">
        <button class="ax-btn is-outline" :disabled="store.loadingLogs" @click="store.fetchAuditLogs">
          <v-icon icon="mdi-refresh" :class="{ spin: store.loadingLogs }"></v-icon>Refresh
        </button>
        <button class="ax-btn is-outline danger" :disabled="!store.auditLogs.length" @click="showClearConfirm = true">
          <v-icon icon="mdi-trash-can-outline"></v-icon>Clear history
        </button>
      </div>
    </div>

    <div class="cards">
      <section class="card">
        <header><span>Last sign-in</span><v-icon icon="mdi-clock-check-outline" size="17"></v-icon></header>
        <div class="big">{{ formatRelativeTime(store.lastLoginTime, 'No sign-ins recorded') }}</div>
        <div class="sub font-mono">{{ formatExactTime(store.lastLoginTime) }}</div>
        <footer v-if="store.previousLoginTime && store.previousLoginTime !== store.lastLoginTime">
          Previous <span class="font-mono">{{ formatExactTime(store.previousLoginTime) }}</span>
        </footer>
      </section>

      <section class="card">
        <header><span>This session</span><v-icon icon="mdi-shield-check-outline" size="17" class="ok"></v-icon></header>
        <div class="big font-mono">{{ store.currentClientIp || '127.0.0.1' }}</div>
        <div class="sub">{{ currentClientSummary }}</div>
        <footer><span class="ax-chip is-ok">Active</span> Auto-lock timer running</footer>
      </section>

      <section class="card">
        <header><span>Activity</span><v-icon icon="mdi-shield-alert-outline" size="17" :class="{ bad: store.failedAttempts > 0 }"></v-icon></header>
        <div class="pair">
          <div><div class="big tabular">{{ store.totalLogins }}</div><div class="sub">Authorized</div></div>
          <div><div class="big tabular" :class="{ bad: store.failedAttempts > 0 }">{{ store.failedAttempts }}</div><div class="sub">Blocked</div></div>
        </div>
        <footer>{{ store.failedAttempts > 0 ? 'Failed attempts recorded. Locked out after 3 failures in 1 min.' : 'No unauthorized attempts recorded.' }}</footer>
      </section>
    </div>

    <div class="filters">
      <div class="ax-seg">
        <button :class="{ 'is-active': filterStatus === 'all' }" @click="filterStatus = 'all'">All <span class="seg-n">{{ store.auditLogs.length }}</span></button>
        <button :class="{ 'is-active': filterStatus === 'success' }" @click="filterStatus = 'success'">Authorized</button>
        <button :class="{ 'is-active': filterStatus === 'failed' }" @click="filterStatus = 'failed'">Blocked</button>
      </div>
      <label class="ax-search">
        <v-icon icon="mdi-magnify"></v-icon>
        <input v-model="searchQuery" class="ax-input" type="search" placeholder="Filter by IP, OS or browser" />
      </label>
    </div>

    <div class="ax-table-wrap">
      <table class="ax-table audit-table">
        <thead>
          <tr><th>Status</th><th>Time</th><th>IP address</th><th>Device</th><th>Browser</th><th></th></tr>
        </thead>
        <tbody>
          <tr v-for="log in filteredLogs" :key="log.id">
            <td class="c-status">
              <span v-if="log.status === 'success'" class="ax-chip is-ok"><v-icon icon="mdi-check" size="12"></v-icon>Authorized</span>
              <span v-else class="ax-chip is-bad"><v-icon icon="mdi-shield-alert" size="12"></v-icon>Blocked</span>
            </td>
            <td class="c-time">
              <div>{{ formatFriendlyDate(log.timestamp) }}</div>
              <div class="cell-sub font-mono">{{ formatExactTime(log.timestamp) }}</div>
            </td>
            <td class="c-ip">
              <span class="font-mono ip">{{ log.ip }}</span>
              <button class="ax-icon-btn copy" title="Copy IP" @click="copyToClipboard(log.ip)"><v-icon icon="mdi-content-copy" size="14"></v-icon></button>
            </td>
            <td class="c-device">
              <div class="with-icon"><v-icon :icon="getDeviceIcon(log.os, log.deviceType)" size="17"></v-icon>
                <div><div>{{ log.os }}</div><div class="cell-sub">{{ log.deviceType }}</div></div>
              </div>
            </td>
            <td class="c-browser">
              <div class="with-icon"><v-icon :icon="getBrowserIcon(log.browser)" size="17"></v-icon>
                <div><div>{{ log.browser }}</div><div class="cell-sub font-mono">{{ log.browserVersion ? `v${log.browserVersion}` : 'Release' }}</div></div>
              </div>
            </td>
            <td class="end c-more"><button class="ax-icon-btn" title="Details" aria-label="Connection details" @click="inspectLog(log)"><v-icon icon="mdi-information-outline" size="17"></v-icon></button></td>
          </tr>
          <tr v-if="!filteredLogs.length" class="is-empty">
            <td colspan="6" class="empty">
              <v-icon icon="mdi-shield-check-outline" size="30"></v-icon>
              <div>No entries</div>
              <small>{{ searchQuery ? 'Try a different search.' : 'Events will appear here once recorded.' }}</small>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Details -->
    <v-dialog v-model="showInspectModal" max-width="500">
      <div class="ax-modal">
        <div class="ax-modal-head">
          <div><h2 class="ax-modal-title">Connection details</h2><p class="ax-modal-sub">Raw client metadata</p></div>
          <button class="ax-icon-btn" @click="showInspectModal = false"><v-icon icon="mdi-close" size="18"></v-icon></button>
        </div>
        <dl v-if="selectedLog" class="dl">
          <div><dt>Time</dt><dd class="font-mono">{{ formatExactTime(selectedLog.timestamp) }}</dd></div>
          <div><dt>IP</dt><dd class="font-mono">{{ selectedLog.ip }}</dd></div>
          <div><dt>System</dt><dd>{{ selectedLog.os }} ({{ selectedLog.deviceType }})</dd></div>
          <div><dt>Browser</dt><dd>{{ selectedLog.browser }} {{ selectedLog.browserVersion }}</dd></div>
          <div class="stack"><dt>User-Agent</dt><dd class="ua font-mono">{{ selectedLog.userAgent || selectedLog.raw || 'None' }}</dd></div>
        </dl>
        <div class="ax-modal-actions"><button class="ax-btn" @click="showInspectModal = false">Close</button></div>
      </div>
    </v-dialog>

    <!-- Clear -->
    <v-dialog v-model="showClearConfirm" max-width="420">
      <div class="ax-modal">
        <div class="ax-modal-head">
          <div><h2 class="ax-modal-title">Clear access history?</h2><p class="ax-modal-sub">All recorded sign-ins and blocked attempts are erased permanently.</p></div>
        </div>
        <div class="ax-modal-actions" style="margin-top: 8px">
          <button class="ax-btn is-ghost" @click="showClearConfirm = false">Cancel</button>
          <button class="ax-btn is-danger" @click="handleClearLogs">Clear history</button>
        </div>
      </div>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useVaultStore } from '../stores/vaultStore'
import { formatRelativeTime } from '../format.js'

const store = useVaultStore()

const filterStatus = ref('all')
const searchQuery = ref('')
const showInspectModal = ref(false)
const showClearConfirm = ref(false)
const selectedLog = ref(null)

const currentClientSummary = computed(() => {
  if (typeof navigator === 'undefined') return 'Connected'
  const ua = navigator.userAgent || ''
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua)
  const isIOS = /iPhone|iPad|iPod/i.test(ua)
  const isAndroid = /Android/i.test(ua)
  const isMac = !isMobile && /Macintosh|Mac OS X/i.test(ua)
  const isWin = !isMobile && /Windows/i.test(ua)
  const isLinux = !isMobile && !isAndroid && /Linux/i.test(ua)
  const osName = isIOS ? 'iOS' : isAndroid ? 'Android' : isMac ? 'macOS' : isWin ? 'Windows' : isLinux ? 'Linux' : 'Workstation'
  const deviceType = isMobile ? 'Mobile' : 'Desktop'
  return `${osName} ${deviceType} · Browser Session`
})

const filteredLogs = computed(() => {
  let list = store.auditLogs || []

  if (filterStatus.value === 'success') {
    list = list.filter(l => l.status === 'success')
  } else if (filterStatus.value === 'failed') {
    list = list.filter(l => l.status === 'failed')
  }

  if (searchQuery.value && searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim()
    list = list.filter(l =>
      (l.ip && l.ip.toLowerCase().includes(q)) ||
      (l.os && l.os.toLowerCase().includes(q)) ||
      (l.browser && l.browser.toLowerCase().includes(q)) ||
      (l.deviceType && l.deviceType.toLowerCase().includes(q)) ||
      (l.userAgent && l.userAgent.toLowerCase().includes(q))
    )
  }

  return list
})

function formatExactTime(isoString) {
  if (!isoString) return '—'
  const d = new Date(isoString)
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

function formatFriendlyDate(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  const today = new Date()
  const isToday = d.toDateString() === today.toDateString()
  if (isToday) {
    return `Today at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
}

function getDeviceIcon(os = '', deviceType = '') {
  const o = os.toLowerCase()
  if (o.includes('ios') || o.includes('iphone') || o.includes('ipad')) return 'mdi-apple-ios'
  if (o.includes('mac')) return 'mdi-apple'
  if (o.includes('windows')) return 'mdi-microsoft-windows'
  if (o.includes('android')) return 'mdi-android'
  if (o.includes('linux')) return 'mdi-linux'
  if (deviceType.toLowerCase().includes('mobile')) return 'mdi-cellphone'
  return 'mdi-laptop'
}

function getBrowserIcon(browser = '') {
  const b = browser.toLowerCase()
  if (b.includes('chrome')) return 'mdi-google-chrome'
  if (b.includes('safari')) return 'mdi-compass-outline'
  if (b.includes('firefox')) return 'mdi-firefox'
  if (b.includes('edge')) return 'mdi-microsoft-edge'
  if (b.includes('opera')) return 'mdi-opera'
  return 'mdi-web'
}

function inspectLog(log) {
  selectedLog.value = log
  showInspectModal.value = true
}

async function copyToClipboard(text) {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    store.showNotice(`Copied IP: ${text}`, 'success')
  } catch (e) {
    store.showNotice(`IP: ${text}`, 'info')
  }
}

async function handleClearLogs() {
  await store.clearAuditLogs()
  showClearConfirm.value = false
}
</script>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 20px;
}
.lead { margin: 0; font-size: 13.5px; color: var(--ax-text-2); }
.tb-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.ax-btn.danger { color: var(--ax-danger); }
.ax-btn.danger:hover:not(:disabled) { background: var(--ax-danger-soft); }
.spin { animation: spin 0.9s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.card {
  display: flex;
  flex-direction: column;
  padding: 18px 20px;
  border-radius: var(--ax-radius-lg);
  background: var(--ax-surface);
  border: 1px solid var(--ax-line);
}
.card header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  font-size: 12px;
  font-weight: 500;
  color: var(--ax-text-2);
}
.card header .v-icon { color: var(--ax-text-3); }
.card header .ok { color: rgb(var(--v-theme-success)); }
.big { font-size: 22px; font-weight: 650; letter-spacing: -0.02em; line-height: 1.2; }
.big.font-mono { font-size: 18px; word-break: break-all; }
.sub { margin-top: 4px; font-size: 12.5px; color: var(--ax-text-2); }
.card footer {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--ax-line);
  font-size: 12px;
  color: var(--ax-text-3);
}
.card > .sub, .card > .pair { margin-bottom: 16px; }
.pair { display: flex; gap: 32px; }
.bad { color: var(--ax-danger) !important; }

.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}
.filters .ax-search { width: 280px; }
.seg-n { color: var(--ax-text-3); }

.copy { position: relative; width: 28px; height: 28px; margin-left: 4px; vertical-align: middle; }
.copy::before { content: ''; position: absolute; inset: -6px; }
.cell-sub { margin-top: 2px; font-size: 12px; color: var(--ax-text-3); }
.with-icon { display: flex; align-items: center; gap: 10px; }
.with-icon > .v-icon { color: var(--ax-text-3); }
.end { text-align: right; }
.empty { padding: 56px 16px !important; text-align: center; color: var(--ax-text-3); }
.empty div { margin-top: 8px; font-size: 14px; font-weight: 550; color: var(--ax-text); }
.empty small { font-size: 12.5px; }

.dl { margin: 0; }
.dl > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 11px 0;
  border-bottom: 1px solid var(--ax-line);
  font-size: 13px;
}
.dl > div.stack { flex-direction: column; gap: 8px; border-bottom: 0; }
.dl dt { color: var(--ax-text-2); }
.dl dd { margin: 0; text-align: right; word-break: break-all; }
.dl .ua {
  text-align: left;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--ax-bg);
  border: 1px solid var(--ax-line);
  font-size: 11.5px;
  line-height: 1.55;
  word-break: break-all;
  color: var(--ax-text-2);
}

@media (max-width: 600px) {
  .toolbar {
    flex-direction: column;
    align-items: flex-start;
  }
  .tb-actions {
    width: 100%;
  }
  .tb-actions .ax-btn {
    flex: 1;
    justify-content: center;
  }
  .cards {
    grid-template-columns: 1fr;
  }
  .filters {
    flex-direction: column;
    align-items: stretch;
  }
  .filters .ax-seg { width: 100%; }
  .filters .ax-seg button { flex: 1; justify-content: center; }
  .filters .ax-search {
    width: 100%;
  }

  /* Log table becomes cards */
  .audit-table thead { display: none; }
  .audit-table, .audit-table tbody { display: block; }
  .audit-table tr {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    grid-template-areas: "status more" "time time" "ip ip" "device browser";
    gap: 10px 12px;
    padding: 14px 16px;
    border-bottom: 1px solid var(--ax-line);
  }
  .audit-table tr:last-child { border-bottom: 0; }
  .audit-table tr.is-empty { display: block; }
  .audit-table td { padding: 0; border: 0; }
  .audit-table tbody tr:hover td { background: none; }
  .c-status { grid-area: status; align-self: center; }
  .c-more { grid-area: more; justify-self: end; }
  .c-time { grid-area: time; }
  .c-ip { grid-area: ip; }
  .c-device { grid-area: device; }
  .c-browser { grid-area: browser; }
}
</style>
