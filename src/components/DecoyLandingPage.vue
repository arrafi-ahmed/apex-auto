<template>
  <div class="site">
    <SiteHeader>
      <nav class="nav d-none d-md-flex" aria-label="Sections">
        <a href="#picks" class="nav-link">Value picks</a>
        <a href="#latest" class="nav-link">Latest news</a>
      </nav>
      <a href="#latest" class="nav-cta">Browse news</a>
    </SiteHeader>

    <!-- Hero (the sign-in trigger word lives in this upper section) -->
    <section class="hero">
      <div class="hero-glow"></div>
      <div class="hero-inner">
        <div class="hero-tag"><span class="pulse"></span><span>BUDGET CARS · DRIVING SKILLS · INDONESIA</span></div>

        <h1>
          Buy smarter.<br />
          <span class="gradient">Drive better.</span>
        </h1>

        <p class="hero-desc">
          Daily news on budget-friendly cars in Indonesia, from the BYD Atto to the Honda Brio and Suzuki Fronx, plus practical driving tips.
          Every story linked to its source, every pick backed by our accuracy
          <span class="trigger-term" role="button" tabindex="0" @click="onTriggerClick" @keydown.enter="onTriggerClick">{{ triggerDisplayWord }}</span>.
        </p>

        <div class="hero-points">
          <span><v-icon icon="mdi-calendar-refresh-outline" size="15"></v-icon>Refreshed daily</span>
          <span><v-icon icon="mdi-cash-multiple" size="15"></v-icon>Budget &amp; value focus</span>
          <span><v-icon icon="mdi-steering" size="15"></v-icon>Driving tips</span>
        </div>
      </div>
    </section>

    <ValuePicks />
    <NewsSection />

    <footer class="footer">
      <div class="footer-inner">
        <div class="footer-brand"><v-icon icon="mdi-car-sports" size="16"></v-icon><b>{{ SITE_NAME }}</b></div>
        <p>
          Headlines and short summaries link to the original publishers, who own their stories and images.
          Prices are indicative; confirm with your dealer.
        </p>
        <div class="copy">&copy; {{ year }} {{ SITE_NAME }}</div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useVaultStore } from '../stores/vaultStore'
import { SITE_NAME } from '../site'
import SiteHeader from './SiteHeader.vue'
import ValuePicks from './ValuePicks.vue'
import NewsSection from './NewsSection.vue'

const store = useVaultStore()
const year = new Date().getFullYear()
const triggerDisplayWord = computed(() => store.triggerWord || 'guarantee')

function onTriggerClick() {
  store.authModalOpen = true
}
</script>

<style scoped>
.site { min-height: 100vh; display: flex; flex-direction: column; background: var(--ax-bg); color: var(--ax-text); }
html { scroll-behavior: smooth; }

.nav { align-items: center; gap: 4px; }
.nav-link { padding: 8px 14px; border-radius: 8px; font-size: 13.5px; font-weight: 500; color: var(--ax-text-2); text-decoration: none; transition: color var(--ax-fast), background-color var(--ax-fast); }
.nav-link:hover { color: var(--ax-text); background: rgba(var(--v-theme-on-surface), 0.06); }
.nav-cta { display: inline-flex; align-items: center; height: 34px; padding: 0 14px; border-radius: 9px; border: 1px solid var(--ax-line-strong); color: var(--ax-text); font-size: 13px; font-weight: 500; text-decoration: none; white-space: nowrap; }
.nav-cta:hover { background: rgba(var(--v-theme-on-surface), 0.06); }

.hero { position: relative; overflow: hidden; padding: 96px 24px 72px; text-align: center; }
.hero-glow { position: absolute; top: -30%; left: 50%; transform: translateX(-50%); width: 800px; max-width: 140vw; height: 480px; background: radial-gradient(circle, var(--ax-accent-soft) 0%, transparent 68%); pointer-events: none; }
.hero-inner { position: relative; max-width: 800px; margin: 0 auto; }
.hero-tag { display: inline-flex; align-items: center; gap: 8px; margin-bottom: 28px; padding: 6px 14px; border-radius: 999px; background: rgba(var(--v-theme-on-surface), 0.04); border: 1px solid var(--ax-line); font-size: 11px; font-weight: 600; letter-spacing: 0.07em; color: var(--ax-text-2); }
.pulse { width: 6px; height: 6px; border-radius: 50%; background: var(--ax-accent); box-shadow: 0 0 8px var(--ax-accent-ring); }
h1 { margin: 0 0 22px; font-size: clamp(32px, 6vw, 56px); font-weight: 700; letter-spacing: -0.032em; line-height: 1.1; }
.gradient { background: linear-gradient(135deg, var(--ax-accent) 0%, #a5adff 60%, var(--ax-text) 100%); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; }
.hero-desc { max-width: 640px; margin: 0 auto 30px; font-size: 17px; line-height: 1.65; color: var(--ax-text-2); }
.trigger-term { color: inherit; cursor: text; user-select: text; text-decoration: none; outline: none; }
.hero-points { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px 24px; font-size: 13px; color: var(--ax-text-3); }
.hero-points span { display: inline-flex; align-items: center; gap: 7px; }
.hero-points .v-icon { color: var(--ax-accent); }

.footer { margin-top: auto; border-top: 1px solid var(--ax-line); padding: 36px 24px; }
.footer-inner { max-width: 1160px; margin: 0 auto; display: flex; flex-wrap: wrap; align-items: center; gap: 12px 32px; font-size: 12.5px; color: var(--ax-text-3); }
.footer-brand { display: flex; align-items: center; gap: 8px; color: var(--ax-text); font-size: 13.5px; }
.footer-brand .v-icon { color: var(--ax-accent); }
.footer p { flex: 1; min-width: 240px; margin: 0; line-height: 1.55; }

@media (max-width: 640px) {
  .hero { padding: 56px 16px 48px; }
  .hero-tag { margin-bottom: 22px; font-size: 10px; }
  .hero-desc { font-size: 15.5px; margin-bottom: 24px; }
  .hero-points { gap: 8px 16px; font-size: 12.5px; }
  .footer { padding: 28px 16px; }
}
</style>
