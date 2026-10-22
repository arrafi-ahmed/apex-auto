<template>
  <a :href="`/news/${item.id}`" class="card" :class="{ 'is-large': large }" @click.prevent="openNews(item.id)">
    <div class="img">
      <img :src="item.image" :alt="item.title" :loading="eager ? 'eager' : 'lazy'" decoding="async" />
      <span v-if="badge" class="badge">{{ badge }}</span>
    </div>
    <div class="body">
      <div class="meta">
        <span class="source">{{ item.source }}</span><i></i><time :datetime="item.publishedAt">{{ relative(item.publishedAt) }}</time>
      </div>
      <h3 class="title">{{ item.title }}</h3>
      <p v-if="item.summary && !compact" class="summary">{{ item.summary }}</p>
      <div v-if="!compact && (item.models?.length || item.tags?.length)" class="tags">
        <span v-for="m in item.models.slice(0, 2)" :key="m" class="tag is-model">{{ m }}</span>
        <span v-if="item.tags?.includes('tips')" class="tag is-tip">Tips</span>
        <span v-if="item.tags?.includes('budget')" class="tag">Value</span>
        <span v-if="item.tags?.includes('ev')" class="tag">EV</span>
        <span v-if="item.tags?.includes('launch')" class="tag">Launch</span>
      </div>
    </div>
  </a>
</template>

<script setup>
import { openNews } from '../router'
import { relativeTime as relative } from '../format'

defineProps({
  item: { type: Object, required: true },
  large: Boolean,
  compact: Boolean,
  eager: Boolean,
  badge: { type: String, default: '' }
})
</script>

<style scoped>
.card {
  display: flex; flex-direction: column; overflow: hidden; text-decoration: none; color: inherit; min-width: 0;
  border-radius: 16px; background: var(--ax-surface); border: 1px solid var(--ax-line);
  transition: border-color var(--ax-med) var(--ax-ease), transform var(--ax-med) var(--ax-ease), box-shadow var(--ax-med) var(--ax-ease);
}
.card:hover, .card:focus-visible { border-color: var(--ax-line-strong); transform: translateY(-2px); box-shadow: var(--ax-shadow); }
.img { position: relative; aspect-ratio: 16 / 10; overflow: hidden; background: var(--ax-surface-2); }
.img img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 600ms var(--ax-ease); }
.card:hover .img img { transform: scale(1.04); }
.badge { position: absolute; left: 12px; top: 12px; padding: 4px 9px; border-radius: 999px; background: rgba(9, 9, 11, 0.7); backdrop-filter: blur(8px); font-size: 11px; font-weight: 600; color: #fff; }
.body { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 18px; min-width: 0; }
.meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--ax-text-3); min-width: 0; }
.meta i { flex: none; width: 3px; height: 3px; border-radius: 50%; background: var(--ax-text-3); }
.source { font-weight: 600; color: var(--ax-accent); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.title { margin: 0; font-size: 15.5px; font-weight: 600; letter-spacing: -0.014em; line-height: 1.38; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.summary { margin: 0; font-size: 13.5px; line-height: 1.55; color: var(--ax-text-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.tags { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 2px; }
.tag { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 500; color: var(--ax-text-2); background: rgba(var(--v-theme-on-surface), 0.06); }
.tag.is-model { color: var(--ax-accent); background: var(--ax-accent-soft); }
.tag.is-tip { color: rgb(var(--v-theme-success)); background: rgba(var(--v-theme-success), 0.12); }
.is-large .title { font-size: 18px; }
@media (max-width: 600px) {
  .title { font-size: 15px; }
  .body { padding: 12px 14px 16px; }
}
</style>
