<template>
  <div class="article-page">
    <SiteHeader @home="backToHome">
      <button class="back" @click="backToHome"><v-icon icon="mdi-arrow-left" size="16"></v-icon>All news</button>
    </SiteHeader>

    <main class="article">
      <template v-if="item">
        <div class="meta">
          <span class="source">{{ item.source }}</span><i></i><time :datetime="item.publishedAt">{{ fullDate(item.publishedAt) }}</time>
        </div>
        <h1>{{ item.title }}</h1>
        <div v-if="item.models?.length || item.tags?.length" class="tags">
          <span v-for="m in item.models" :key="m" class="tag is-model">{{ m }}</span>
          <span v-if="item.tags?.includes('tips')" class="tag is-tip">Driving tips</span>
          <span v-if="item.tags?.includes('budget')" class="tag">Budget &amp; value</span>
          <span v-if="item.tags?.includes('ev')" class="tag">EV</span>
          <span v-if="item.tags?.includes('launch')" class="tag">Launch</span>
          <span v-if="item.tags?.includes('review')" class="tag">Review</span>
        </div>
        <figure class="hero">
          <img :src="item.image" :alt="item.title" />
          <figcaption>Image: {{ item.source }}</figcaption>
        </figure>
        <p v-if="item.summary" class="summary">{{ item.summary }}</p>
        <a class="read-more" :href="item.link" target="_blank" rel="noopener noreferrer nofollow">
          Read the full story at {{ item.source }}<v-icon icon="mdi-arrow-top-right" size="17"></v-icon>
        </a>
      </template>

      <div v-else-if="loading" class="state" aria-busy="true"><div class="spinner"></div></div>

      <div v-else class="state">
        <h1>Article not found</h1>
        <p>It may have rotated out of the archive.</p>
        <button class="read-more" @click="backToHome">Back to news</button>
      </div>

      <section v-if="related.length" class="related">
        <h2>More like this</h2>
        <div class="related-grid">
          <NewsCard v-for="r in related" :key="r.id" :item="r" compact />
        </div>
      </section>
    </main>
  </div>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { route, backToHome } from '../router'
import { fullDate } from '../format'
import { SITE_NAME } from '../site'
import SiteHeader from './SiteHeader.vue'
import NewsCard from './NewsCard.vue'

const item = ref(null)
const related = ref([])
const loading = ref(true)
const originalTitle = document.title

async function load(id) {
  loading.value = true
  item.value = null
  try {
    const [detail, list] = await Promise.all([
      fetch(`/api/news/${id}`).then(r => (r.ok ? r.json() : null)),
      fetch('/api/news?pageSize=48').then(r => (r.ok ? r.json() : { items: [] }))
    ])
    item.value = detail
    // Prefer stories that share a model or topic with this one, then fall back to the newest
    const shared = (i) => (detail ? [...(i.models || []), ...(i.tags || [])].filter(t => [...(detail.models || []), ...(detail.tags || [])].includes(t)).length : 0)
    related.value = list.items
      .filter(i => i.id !== id)
      .map((i, idx) => ({ i, score: shared(i) * 10 - idx * 0.1 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(x => x.i)
    document.title = detail ? `${detail.title} | ${SITE_NAME}` : originalTitle
  } catch {
    item.value = null
  } finally {
    loading.value = false
  }
}

watch(() => route.id, (id) => id && load(id), { immediate: true })
onUnmounted(() => { document.title = originalTitle })
</script>

<style scoped>
.article-page { min-height: 100vh; background: var(--ax-bg); color: var(--ax-text); }
.back { display: inline-flex; align-items: center; gap: 6px; height: 36px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--ax-line-strong); background: transparent; color: var(--ax-text); font: 500 13px/1 var(--font-sans); cursor: pointer; white-space: nowrap; }
.back:hover { background: rgba(var(--v-theme-on-surface), 0.06); }

.article { max-width: 1160px; margin: 0 auto; padding: 48px 24px 96px; }
.article > .meta, .article > h1, .article > .tags, .article > .hero, .article > .summary, .article > .read-more { max-width: 760px; margin-left: auto; margin-right: auto; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 10px; font-size: 13px; color: var(--ax-text-3); }
.meta i { width: 3px; height: 3px; border-radius: 50%; background: var(--ax-text-3); }
.source { font-weight: 600; color: var(--ax-accent); }
h1 { margin-top: 14px; margin-bottom: 18px; font-size: clamp(26px, 5vw, 40px); font-weight: 680; letter-spacing: -0.03em; line-height: 1.16; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 24px; }
.tag { padding: 3px 9px; border-radius: 6px; font-size: 12px; font-weight: 500; color: var(--ax-text-2); background: rgba(var(--v-theme-on-surface), 0.06); }
.tag.is-model { color: var(--ax-accent); background: var(--ax-accent-soft); }
.tag.is-tip { color: rgb(var(--v-theme-success)); background: rgba(var(--v-theme-success), 0.12); }
.hero { margin-top: 0; margin-bottom: 28px; }
.hero img { width: 100%; max-height: 480px; object-fit: cover; display: block; border-radius: 16px; border: 1px solid var(--ax-line); background: var(--ax-surface); }
.hero figcaption { margin-top: 8px; font-size: 12px; color: var(--ax-text-3); }
.summary { margin-top: 0; margin-bottom: 32px; font-size: 18px; line-height: 1.7; color: var(--ax-text-2); }
.read-more {
  display: flex; width: fit-content; align-items: center; gap: 8px; min-height: 46px; padding: 0 22px; border-radius: 12px; border: 0; background: var(--ax-accent); color: #fff;
  font: 550 14.5px/1 var(--font-sans); text-decoration: none; cursor: pointer; box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.18);
}
.read-more:hover { background: rgb(var(--v-theme-primary-darken-1)); }

.state { padding: 96px 0; text-align: center; color: var(--ax-text-2); }
.state h1 { margin-bottom: 8px; font-size: 24px; }
.state p { margin: 0 0 24px; }
.state .read-more { margin: 0 auto; }
.spinner { width: 24px; height: 24px; margin: 0 auto; border-radius: 50%; border: 2px solid var(--ax-line-strong); border-top-color: var(--ax-accent); animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.related { margin-top: 72px; padding-top: 32px; border-top: 1px solid var(--ax-line); }
.related h2 { margin: 0 0 20px; font-size: 18px; font-weight: 600; letter-spacing: -0.015em; }
.related-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
@media (max-width: 800px) { .related-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .article { padding: 28px 16px 64px; }
  .summary { font-size: 16.5px; }
  .hero img { border-radius: 12px; }
  .read-more { width: 100%; justify-content: center; }
  .related { margin-top: 48px; }
}
</style>
