<template>
  <header class="site-header">
    <div class="site-header-inner">
      <a class="brand" href="/" @click.prevent="$emit('home')">
        <span class="brand-icon"><v-icon icon="mdi-car-sports" size="20"></v-icon></span>
        <span class="brand-text">
          <span class="brand-title">{{ SITE_NAME }}</span>
          <span class="brand-sub">{{ SITE_TAGLINE }}</span>
        </span>
      </a>
      <slot />
    </div>
  </header>
</template>

<script setup>
import { SITE_NAME, SITE_TAGLINE } from '../site'
defineEmits(['home'])
</script>

<style scoped>
.site-header {
  position: sticky; top: 0; z-index: 20; border-bottom: 1px solid var(--ax-line);
  background: var(--ax-glass); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
}
.site-header-inner { max-width: 1160px; height: 64px; margin: 0 auto; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.brand { display: flex; align-items: center; gap: 12px; min-width: 0; color: inherit; text-decoration: none; }
.brand-icon { flex: none; display: grid; place-items: center; width: 34px; height: 34px; border-radius: 9px; background: var(--ax-accent-soft); border: 1px solid var(--ax-accent-ring); color: var(--ax-accent); }
.brand-text { display: flex; flex-direction: column; min-width: 0; }
.brand-title { font-size: 14.5px; font-weight: 650; letter-spacing: -0.012em; line-height: 1.2; white-space: nowrap; }
.brand-sub { font-size: 9.5px; letter-spacing: 0.16em; color: var(--ax-text-3); white-space: nowrap; }
@media (max-width: 640px) { .site-header-inner { height: 58px; padding: 0 16px; } }
</style>
