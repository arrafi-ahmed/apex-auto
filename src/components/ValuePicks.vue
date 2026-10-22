<template>
  <section v-if="loading || items.length" id="picks" class="picks">
    <div class="wrap">
      <div class="head">
        <div>
          <div class="kicker">VALUE PICKS</div>
          <h2>Budget cars worth a look</h2>
        </div>
      </div>
      <div class="grid" :aria-busy="loading">
        <template v-if="loading">
          <div v-for="n in 4" :key="n" class="sk"><div class="sk-img ax-skeleton"></div><div class="sk-line ax-skeleton"></div><div class="sk-line short ax-skeleton"></div></div>
        </template>
        <NewsCard v-for="(item, i) in items" v-else :key="item.id" :item="item" compact :eager="i < 2" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import NewsCard from './NewsCard.vue'

const items = ref([])
const loading = ref(true)

onMounted(async () => {
  try {
    const res = await fetch('/api/news/picks')
    if (res.ok) items.value = (await res.json()).items
  } catch { /* the section hides itself */ } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.picks { padding: 8px 0 72px; scroll-margin-top: 70px; }
.wrap { max-width: 1160px; margin: 0 auto; padding: 0 24px; }
.head { margin-bottom: 24px; }
.kicker { margin-bottom: 8px; font-size: 11.5px; font-weight: 600; letter-spacing: 0.14em; color: var(--ax-accent); }
h2 { margin: 0; font-size: 26px; font-weight: 650; letter-spacing: -0.025em; line-height: 1.2; }
.grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 18px; }
.sk { display: flex; flex-direction: column; gap: 12px; }
.sk-img { aspect-ratio: 16 / 10; border-radius: 16px; }
.sk-line { height: 14px; width: 85%; border-radius: 6px; }
.sk-line.short { width: 50%; }
@media (max-width: 1000px) { .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@media (max-width: 600px) {
  .picks { padding-bottom: 48px; }
  .wrap { padding: 0 16px; }
  h2 { font-size: 21px; }
  /* swipeable row instead of a long stack on phones */
  .grid { display: flex; gap: 12px; overflow-x: auto; margin: 0 -16px; padding: 2px 16px 12px; scroll-snap-type: x mandatory; scroll-padding: 0 16px; scrollbar-width: none; }
  .grid::-webkit-scrollbar { display: none; }
  .grid > * { flex: 0 0 78%; scroll-snap-align: start; }
}
</style>
