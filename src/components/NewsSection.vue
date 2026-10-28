<template>
  <section id="latest" class="latest">
    <div class="ax-container">
      <div class="ax-section-head">
        <div>
          <div class="ax-eyebrow">LATEST NEWS</div>
          <h2 class="ax-section-title">Budget cars and driving know-how</h2>
        </div>
        <span v-if="data.archiveTotal" class="stamp">{{ data.archiveTotal }} stories · {{ data.sources }} sources<template v-if="data.updatedAt"> · updated {{ relativeTime(data.updatedAt) }}</template></span>
      </div>

      <!-- Search -->
      <label class="search">
        <v-icon icon="mdi-magnify" size="18"></v-icon>
        <input v-model="search" type="search" inputmode="search" enterkeyhint="search" placeholder="Search cars, prices, tips…" aria-label="Search news" />
      </label>

      <!-- Topic tabs -->
      <div class="scroller" role="tablist" aria-label="Topics">
        <button
          v-for="t in topics"
          :key="t.id"
          class="tab"
          :class="{ 'is-active': topic === t.id }"
          role="tab"
          :aria-selected="topic === t.id"
          @click="setTopic(t.id)"
        >{{ t.label }}<span class="n">{{ data.counts?.[t.id] ?? 0 }}</span></button>
      </div>

      <!-- Model watchlist -->
      <div v-if="data.models?.length" class="scroller chips" aria-label="Models">
        <span class="chips-label">Following</span>
        <button
          v-for="m in data.models"
          :key="m.label"
          class="chip"
          :class="{ 'is-active': model === m.label }"
          :aria-pressed="model === m.label"
          @click="setModel(m.label)"
        >{{ m.label }}<span class="n">{{ m.count }}</span></button>
      </div>

      <!-- Results -->
      <div v-if="loading && !data.items.length" class="grid" aria-busy="true">
        <div v-for="n in 6" :key="n" class="sk"><div class="sk-img ax-skeleton"></div><div class="sk-line ax-skeleton"></div><div class="sk-line short ax-skeleton"></div></div>
      </div>

      <div v-else-if="!data.items.length" class="empty">
        <v-icon icon="mdi-newspaper-variant-outline" size="30"></v-icon>
        <p>{{ data.archiveTotal ? 'No stories match your filters.' : 'News is on its way. Please check back shortly.' }}</p>
        <button v-if="hasFilters" class="ax-btn is-outline" @click="reset">Clear filters</button>
      </div>

      <div v-else class="grid" :class="{ 'is-loading': loading }">
        <NewsCard v-for="(item, i) in data.items" :key="item.id" :item="item" :row="i > 0" :eager="i < 3" />
      </div>

      <!-- Pagination -->
      <nav v-if="data.totalPages > 1" class="pager" aria-label="News pages">
        <button class="pg arrow" :disabled="data.page <= 1" aria-label="Previous page" @click="go(data.page - 1)">
          <v-icon icon="mdi-chevron-left" size="18"></v-icon><span class="arrow-text">Prev</span>
        </button>
        <template v-for="(p, i) in pageList" :key="`${p}-${i}`">
          <span v-if="p === '…'" class="dots">…</span>
          <button v-else class="pg num" :class="{ 'is-current': p === data.page }" :aria-current="p === data.page ? 'page' : undefined" @click="go(p)">{{ p }}</button>
        </template>
        <span class="status">Page {{ data.page }} of {{ data.totalPages }}</span>
        <button class="pg arrow" :disabled="data.page >= data.totalPages" aria-label="Next page" @click="go(data.page + 1)">
          <span class="arrow-text">Next</span><v-icon icon="mdi-chevron-right" size="18"></v-icon>
        </button>
      </nav>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import NewsCard from './NewsCard.vue'
import { relativeTime } from '../format'

const PAGE_SIZE = 12
const DEFAULT_TOPIC = 'all'
const topics = [
  { id: 'all', label: 'All' },
  { id: 'budget', label: 'Budget & value' },
  { id: 'tips', label: 'Driving tips' },
  { id: 'ev', label: 'EV & hybrid' },
  { id: 'launch', label: 'Launches' },
  { id: 'review', label: 'Reviews' }
]

const data = ref({ items: [], page: 1, totalPages: 1, total: 0, counts: {}, models: [], updatedAt: null, archiveTotal: 0, sources: 0 })
const loading = ref(true)

// Filters live in the URL (replaceState) so Back from an article returns to the same view
const params = new URLSearchParams(location.search)
const topic = ref(topics.some(t => t.id === params.get('topic')) ? params.get('topic') : DEFAULT_TOPIC)
const model = ref(params.get('model') || '')
const search = ref(params.get('q') || '')
const page = ref(Math.max(1, Number(params.get('page')) || 1))

const hasFilters = computed(() => topic.value !== DEFAULT_TOPIC || model.value || search.value.trim())

// 1 … 4 5 6 … 18
const pageList = computed(() => {
  const total = data.value.totalPages
  const cur = data.value.page
  const out = []
  for (let p = 1; p <= total; p++) {
    if (p === 1 || p === total || Math.abs(p - cur) <= 1) out.push(p)
    else if (out[out.length - 1] !== '…') out.push('…')
  }
  return out
})

let controller = null
async function load() {
  controller?.abort()
  controller = new AbortController()
  loading.value = true
  const qs = new URLSearchParams({ page: page.value, pageSize: PAGE_SIZE })
  if (topic.value !== 'all') qs.set('topic', topic.value)
  if (model.value) qs.set('model', model.value)
  if (search.value.trim()) qs.set('q', search.value.trim())
  try {
    const res = await fetch(`/api/news?${qs}`, { signal: controller.signal })
    if (res.ok) {
      data.value = await res.json()
      page.value = data.value.page
      syncUrl()
    }
    loading.value = false
  } catch (err) {
    if (err.name !== 'AbortError') loading.value = false
  }
}

function syncUrl() {
  const url = new URL(location.href)
  const set = (key, value, empty) => (value === empty ? url.searchParams.delete(key) : url.searchParams.set(key, value))
  set('topic', topic.value, DEFAULT_TOPIC)
  set('model', model.value, '')
  set('q', search.value.trim(), '')
  set('page', page.value, 1)
  history.replaceState(history.state, '', url)
}

function scrollToList() {
  document.getElementById('latest')?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

function setTopic(id) {
  topic.value = id
  model.value = ''
  page.value = 1
  load()
}

function setModel(label) {
  model.value = model.value === label ? '' : label
  page.value = 1
  load()
}

function go(p) {
  if (p < 1 || p > data.value.totalPages || p === data.value.page) return
  page.value = p
  load().then(scrollToList)
}

function reset() {
  topic.value = DEFAULT_TOPIC
  model.value = ''
  search.value = ''
  page.value = 1
  load()
}

let debounce = null
watch(search, () => {
  clearTimeout(debounce)
  debounce = setTimeout(() => {
    model.value = ''
    page.value = 1
    load()
  }, 350)
})

onMounted(load)
onUnmounted(() => { clearTimeout(debounce); controller?.abort() })
</script>

<style scoped>
.latest { padding: 8px 0 96px; }
.stamp { font-size: 12.5px; color: var(--ax-text-3); text-align: right; }

.search { position: relative; display: block; margin-bottom: 16px; }
.search .v-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--ax-text-3); pointer-events: none; }
.search input {
  width: 100%; height: 46px; padding: 0 14px 0 42px; border-radius: 12px; border: 1px solid var(--ax-line-strong);
  background: var(--ax-surface); color: var(--ax-text); font: 400 15px/1 var(--font-sans); outline: none;
  transition: border-color var(--ax-fast), box-shadow var(--ax-fast);
}
.search input::placeholder { color: var(--ax-text-3); }
.search input:focus { border-color: var(--ax-accent); box-shadow: 0 0 0 3px var(--ax-accent-soft); }

.scroller { display: flex; align-items: center; gap: 8px; overflow-x: auto; scrollbar-width: none; margin-bottom: 14px; -webkit-overflow-scrolling: touch; }
.scroller::-webkit-scrollbar { display: none; }
.tab, .chip {
  flex: none; display: inline-flex; align-items: center; gap: 8px; height: 38px; padding: 0 14px; border-radius: 999px; border: 1px solid var(--ax-line);
  background: transparent; color: var(--ax-text-2); font: 500 13.5px/1 var(--font-sans); white-space: nowrap; cursor: pointer;
  transition: background-color var(--ax-fast), color var(--ax-fast), border-color var(--ax-fast);
}
.tab:hover, .chip:hover { color: var(--ax-text); border-color: var(--ax-line-strong); }
.tab.is-active { background: var(--ax-text); border-color: var(--ax-text); color: var(--ax-bg); }
.chip { height: 32px; padding: 0 12px; font-size: 12.5px; }
.chip.is-active { background: var(--ax-accent-soft); border-color: var(--ax-accent-ring); color: var(--ax-accent); }
.n { font-size: 11.5px; opacity: 0.6; font-variant-numeric: tabular-nums; }
.chips-label { flex: none; font-size: 12px; font-weight: 600; color: var(--ax-text-3); margin-right: 2px; }
.chips { margin-bottom: 24px; }

.grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; transition: opacity 0.15s; }
.grid.is-loading { opacity: 0.5; }
.sk { display: flex; flex-direction: column; gap: 12px; }
.sk-img { aspect-ratio: 16 / 10; border-radius: 16px; }
.sk-line { height: 14px; width: 85%; border-radius: 6px; }
.sk-line.short { width: 50%; }

.empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 72px 16px; text-align: center; color: var(--ax-text-2); border: 1px dashed var(--ax-line-strong); border-radius: 16px; }
.empty p { margin: 0; font-size: 14.5px; }

.pager { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 6px; margin-top: 40px; }
.pg {
  display: inline-flex; align-items: center; justify-content: center; gap: 4px; min-width: 40px; height: 40px; padding: 0 12px; border-radius: 10px;
  border: 1px solid var(--ax-line); background: transparent; color: var(--ax-text-2); font: 500 14px/1 var(--font-sans); cursor: pointer;
  transition: background-color var(--ax-fast), color var(--ax-fast), border-color var(--ax-fast);
}
.pg:hover:not(:disabled) { background: rgba(var(--v-theme-on-surface), 0.06); color: var(--ax-text); }
.pg.is-current { background: var(--ax-accent-soft); border-color: var(--ax-accent-ring); color: var(--ax-accent); }
.pg:disabled { opacity: 0.35; cursor: default; }
.dots { padding: 0 4px; color: var(--ax-text-3); }
.status { display: none; font-size: 13px; color: var(--ax-text-2); font-variant-numeric: tabular-nums; }

@media (max-width: 960px) {
  .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 600px) {
  .latest { padding-bottom: 64px; }
  .stamp { text-align: left; }
  .search input { font-size: 16px; }
  .grid { grid-template-columns: 1fr; gap: 12px; }
  .scroller {
    margin-inline: calc(var(--ax-gutter) * -1);
    padding: 0 var(--ax-gutter);
    mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 24px), transparent 100%);
    -webkit-mask-image: linear-gradient(to right, transparent 0, #000 16px, #000 calc(100% - 24px), transparent 100%);
  }
  .pager { gap: 8px; }
  .pg.num, .dots { display: none; }
  .status { display: inline; order: 2; }
  .pg.arrow:first-child { order: 1; flex: 1; }
  .pg.arrow:last-child { order: 3; flex: 1; }
  .pg { height: 44px; }
}
</style>
