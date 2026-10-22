import fs from 'fs'
import path from 'path'
import net from 'net'
import crypto from 'crypto'
import dns from 'dns/promises'
import sharp from 'sharp'
import { DATA_DIR } from './db.js'

// ─────────────────────────────────────────────────────────────────────────────
// Car-news archive for the public site.
//   • polls a few Indonesian car publishers once a day (plus targeted Bing News searches)
//   • keeps only stories about budget cars in Indonesia and driving skills/tips
//   • keeps an accumulating archive (up to MAX_ITEMS / MAX_AGE_DAYS)
//   • stores headline + short summary + link, plus a thumbnail copied to our own disk
//   • tags every story (budget & value, driving tips, EV, launch, review, model watchlist)
// Visitors only ever talk to this server, never to the publishers.
// ─────────────────────────────────────────────────────────────────────────────

const NEWS_DIR = path.join(DATA_DIR, 'news')
const IMAGE_DIR = path.join(NEWS_DIR, 'images')
const NEWS_FILE = path.join(NEWS_DIR, 'news.json')
fs.mkdirSync(IMAGE_DIR, { recursive: true })

const MAX_ITEMS = 200 // archive size
const MAX_AGE_DAYS = 60
const MAX_PER_SOURCE_PER_RUN = 100
const MAX_NEW_PER_RUN = 100 // new stories (and images) added per refresh
const IMAGE_CONCURRENCY = 6
const REFRESH_MS = Math.max(1, Number(process.env.NEWS_REFRESH_HOURS) || 24) * 60 * 60 * 1000
const USER_AGENT = 'Mozilla/5.0 (compatible; ApexAutoNewsDigest/1.0)'

// `Name|url|filters|lang` — filters are comma-separated link fragments: plain ones must
// appear in the article link, `!`-prefixed ones must not (drops motorbike/gallery sections).
const DEFAULT_FEEDS = [
  'detikOto|https://oto.detik.com/rss|!/motor/,!/otosport/,!/foto-oto/,!/oto-galeri/|id',
  'CNN Indonesia|https://www.cnnindonesia.com/otomotif/rss||id',
  'Liputan6 Otomotif|https://feed.liputan6.com/rss/otomotif||id',
  'ANTARA Otomotif|https://www.antaranews.com/rss/otomotif.xml||id'
]

function feedConfig() {
  const raw = process.env.NEWS_FEEDS ? process.env.NEWS_FEEDS.split(';') : DEFAULT_FEEDS
  return raw
    .map(entry => {
      const [name, url, filter, lang] = entry.split('|').map(s => s.trim())
      if (!name || !/^https?:\/\//.test(url || '')) return null
      const parts = filter ? filter.split(',').filter(Boolean) : []
      return {
        name,
        url,
        lang: lang || 'en',
        include: parts.filter(p => !p.startsWith('!')),
        exclude: parts.filter(p => p.startsWith('!')).map(p => p.slice(1))
      }
    })
    .filter(Boolean)
}

// ---- Topic tagging ----
// Models/brands readers care about (value-for-money cars in Indonesia). `label` is the chip.
export const WATCHLIST = [
  { label: 'BYD', re: /\bBYD\b|\batto\b|\bdolphin\b|\bseagull\b|\bsealion\b/i },
  { label: 'Atto', re: /\batto\b/i },
  { label: 'Brio', re: /\bbrio\b/i },
  { label: 'Fronx', re: /\bfronx\b/i },
  { label: 'Agya', re: /\bagya\b/i },
  { label: 'Raize', re: /\braize\b/i },
  { label: 'Xpander', re: /\bxpander\b/i },
  { label: 'Avanza', re: /\bavanza\b|\bveloz\b/i },
  { label: 'Wuling', re: /\bwuling\b/i },
  { label: 'VinFast', re: /\bvinfast\b/i },
  { label: 'Chery', re: /\bchery\b|\bomoda\b|\bjaecoo\b/i },
  { label: 'Geely', re: /\bgeely\b/i }
]

const TOPIC_PATTERNS = {
  indonesia: /indonesia|jakarta|rupiah|\bRp\s?\d|\bIIMS\b|\bGIIAS\b|\bLCGC\b|kemenperin|gaikindo|\bpajak\b/i,
  budget: /dibanderol|banderol|mulai (?:dari )?Rp|city car|Rp\.?\s?(?:1\d{2}|2\d{2}|\d{2})(?:[.,]\d+)?\s?(?:jutaan|juta)\b|murah|terjangkau|irit|ekonomis|hemat|budget|affordable|cheap|value[- ]for[- ]money|good value|best value|great value|bang for|harga mulai|starting (?:at|from)|di ?bawah Rp|under (?:US)?\$|\bLCGC\b|entry[- ]level|cicilan|diskon|promo|cuci gudang|mobil bekas|\bRM ?\d{2},\d{3}\b/i,
  ev: /listrik|\bEV\b|\bBEV\b|\bPHEV\b|electric|hybrid|hibrida|\bBYD\b|\batto\b|dolphin|\bseal\b|ioniq|vinfast|charger|pengisian daya|baterai|battery/i,
  launch: /launch|unveil|debut|reveal|premiere|meluncur|diluncurkan|resmi (?:hadir|meluncur|dirilis|diperkenalkan)|dirilis|rilis|perkenalkan|tampil perdana|facelift|all[- ]new/i,
  tips: /\btips\b|\bcara\b.{0,40}(?:mengemudi|menyetir|nyetir|berkendara|parkir|menyalip|mundur|menanjak|hemat|irit|merawat|mengecek)|defensive driving|safe driving|driving (?:tips|skills?|lessons?)|eco[- ]?driving|belajar (?:menyetir|mengemudi|nyetir|mobil)|teknik (?:mengemudi|menyetir|berkendara)|\btrik\b|hemat bbm|irit bbm|konsumsi bbm|perawatan|merawat|servis berkala|ganti oli|tekanan ban|mengemudi|menyetir|berkendara aman|keselamatan berkendara|etika berkendara|rem blong|kopling/i,
  review: /review|test drive|tested|first drive|road test|ulasan|komparasi|perbandingan|\bvs\b|uji (?:jalan|coba)|menjajal/i
}

// Motorbike coverage slips into mixed feeds; this site is about cars
const MOTORCYCLE = /sepeda motor|naik motor|pengendara motor|motor (?:matic|sport|bebek|trail)|\bjok\b|\bhelm\b|skutik|skuter|motor listrik|motogp|\bmoge\b|\bnmax\b|\bpcx\b|\bvario\b|\bscoopy\b|\bvespa\b|\bducati\b|\bkawasaki\b|\bninja\b|royal enfield|\bharley|motocross|motorcycle|motorbike|scooter|\bhonda (?:beat|adv|cbr|crf)\b|\byamaha (?:r\d|mt-|aerox|fazzio)\b/i

// Only stories a budget-minded Indonesian buyer or learner-driver would read are kept
export function isRelevant(item) {
  const { tags, models } = classify(item)
  return tags.includes('budget') || tags.includes('tips') ||
    ((tags.includes('launch') || tags.includes('review')) && (item.lang === 'id' || models.length > 0))
}

export function classify(item) {
  const text = `${item.title} ${item.summary || ''}`
  const tags = []
  for (const [tag, re] of Object.entries(TOPIC_PATTERNS)) {
    if (re.test(text)) tags.push(tag)
  }
  if (item.lang === 'id' && !tags.includes('indonesia')) tags.push('indonesia')
  const models = WATCHLIST.filter(w => w.re.test(text)).map(w => w.label)
  return { tags, models }
}

// ---- Outbound fetching with SSRF protection (public hosts only, bounded size/time) ----
const privateRanges = new net.BlockList()
for (const [addr, bits] of [['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12], ['192.168.0.0', 16]]) {
  privateRanges.addSubnet(addr, bits, 'ipv4')
}
privateRanges.addAddress('::1', 'ipv6')
privateRanges.addSubnet('fc00::', 7, 'ipv6')
privateRanges.addSubnet('fe80::', 10, 'ipv6')

async function assertPublicUrl(urlStr) {
  const url = new URL(urlStr)
  if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('Unsupported protocol')
  const addrs = await dns.lookup(url.hostname, { all: true })
  for (const { address } of addrs) {
    const mapped = address.startsWith('::ffff:') ? address.slice(7) : address
    if (address === '::' || privateRanges.check(mapped, net.isIPv6(mapped) ? 'ipv6' : 'ipv4')) {
      throw new Error('Blocked private address')
    }
  }
}

async function safeFetch(urlStr, { maxBytes = 5 * 1024 * 1024, timeout = 15000, accept = '*/*' } = {}) {
  let current = urlStr
  for (let hop = 0; hop < 4; hop++) {
    await assertPublicUrl(current)
    const res = await fetch(current, {
      redirect: 'manual',
      signal: AbortSignal.timeout(timeout),
      headers: { 'User-Agent': USER_AGENT, Accept: accept }
    })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location'), current).href
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const chunks = []
    let size = 0
    for await (const chunk of res.body) {
      size += chunk.length
      if (size > maxBytes) throw new Error('Response too large')
      chunks.push(chunk)
    }
    return { body: Buffer.concat(chunks), contentType: res.headers.get('content-type') || '' }
  }
  throw new Error('Too many redirects')
}

// ---- Minimal RSS parsing ----
const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…' }

function decodeEntities(str) {
  return str
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

function tagText(block, tag) {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i'))
  if (!m) return ''
  return m[1].replace(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/, '$1').trim()
}

function plainText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function clip(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), max - 40)).replace(/[.,;:!\s]+$/, '') + '…'
}

function firstImageUrl(block) {
  const attr = (re) => block.match(re)?.[1]
  return (
    attr(/<media:content[^>]*\burl="([^"]+)"/i) ||
    attr(/<media:thumbnail[^>]*\burl="([^"]+)"/i) ||
    attr(/<enclosure[^>]*type="image\/[^"]*"[^>]*\burl="([^"]+)"/i) ||
    attr(/<enclosure[^>]*\burl="([^"]+)"[^>]*type="image\/[^"]*"/i) ||
    attr(/<img[^>]*\bsrc=["']([^"']+)["']/i) ||
    null
  )
}

// Some CDNs hand out postage-stamp thumbnails by default; ask for a card-sized version
function upsizeImage(url) {
  try {
    const u = new URL(url)
    if (u.hostname.endsWith('detik.net.id') && u.searchParams.get('w') && Number(u.searchParams.get('w')) < 720) {
      u.searchParams.set('w', '720')
      return u.href
    }
  } catch { /* keep the original */ }
  return url
}

function parseRss(xml, feed) {
  const items = []
  for (const m of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = m[1]
    const link = decodeEntities(tagText(block, 'link'))
    const title = plainText(tagText(block, 'title'))
    if (!title || !/^https?:\/\//.test(link)) continue
    if (feed.include.length && !feed.include.some(f => link.includes(f))) continue
    if (feed.exclude.some(f => link.includes(f))) continue

    const date = new Date(tagText(block, 'pubDate') || tagText(block, 'dc:date'))
    const image = firstImageUrl(block)
    const summary = clip(plainText(tagText(block, 'description') || tagText(block, 'content:encoded')), 360)
    if (MOTORCYCLE.test(`${title} ${summary}`)) continue
    items.push({
      title,
      summary,
      link,
      source: feed.name,
      lang: feed.lang,
      publishedAt: isNaN(date) ? new Date().toISOString() : date.toISOString(),
      imageUrl: image ? upsizeImage(decodeEntities(image)) : null
    })
  }
  return items
}

async function fromFeed(feed) {
  const { body } = await safeFetch(feed.url, { maxBytes: 6 * 1024 * 1024, accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5' })
  return parseRss(body.toString('utf-8'), feed)
}

// Optional extra source: NewsData.io (free tier), keyword-filtered to new-car news
async function fromNewsData() {
  const key = process.env.NEWSDATA_API_KEY
  if (!key) return []
  const q = process.env.NEWSDATA_QUERY || '"mobil baru" OR "mobil listrik" OR "BYD" OR "Honda Brio" OR "Suzuki Fronx"'
  const url = `https://newsdata.io/api/1/latest?apikey=${encodeURIComponent(key)}&country=id&q=${encodeURIComponent(q)}`
  const { body } = await safeFetch(url, { maxBytes: 2 * 1024 * 1024, accept: 'application/json' })
  const data = JSON.parse(body.toString('utf-8'))
  return (data.results || [])
    .filter(r => r.title && r.link)
    .map(r => {
      const summary = clip(plainText(r.description || ''), 360)
      return {
        title: plainText(r.title),
        summary,
        link: r.link,
        source: r.source_name || r.source_id || 'News',
        lang: r.language === 'indonesian' ? 'id' : 'en',
        publishedAt: r.pubDate ? new Date(r.pubDate.replace(' ', 'T') + 'Z').toISOString() : new Date().toISOString(),
        imageUrl: r.image_url || null
      }
    })
    .filter(i => !MOTORCYCLE.test(`${i.title} ${i.summary}`))
}

// ---- Model-targeted coverage via Bing News RSS (unofficial public feed) ----
// One query per car/topic readers follow; results come from many Indonesian outlets (Kompas,
// GridOto, Bisnis Otomotif…) whose own feeds are blocked or missing. Disable with NEWS_BING=off.
const DEFAULT_BING_QUERIES = [
  // budget cars readers follow
  'BYD Atto 1', 'BYD Atto 3', 'BYD Dolphin', 'Honda Brio', 'Suzuki Fronx', 'Toyota Agya', 'Toyota Raize',
  'Mitsubishi Xpander', 'Wuling Air ev', 'VinFast VF 3', 'Daihatsu Ayla Sigra',
  'mobil murah terbaru', 'mobil listrik murah', 'LCGC terbaru', 'harga mobil baru', 'mobil bekas murah',
  // learning to drive
  'tips mengemudi', 'cara menyetir mobil matic', 'defensive driving', 'tips irit bbm mobil', 'cara parkir mobil'
]
// Bing surfaces hundreds of outlets; only established Indonesian car/news publishers are kept.
// Override with NEWS_SOURCE_ALLOW (comma-separated, case-insensitive prefixes of the outlet name).
const DEFAULT_ALLOWED_SOURCES = [
  'kompas otomotif', 'kompas.com', 'gridoto', 'otomotifnet', 'otomania', 'bisnis', 'oto.com', 'otosia', 'mobil123',
  'carmudi', 'detik', 'cnn', 'cnbc', 'liputan6', 'antara', 'tempo', 'kumparan', 'uzone', 'viva', 'medcom',
  'okezone', 'autofun', 'carsome', 'suara.com'
]
function allowedSources() {
  return process.env.NEWS_SOURCE_ALLOW ? process.env.NEWS_SOURCE_ALLOW.split(',').map(x => x.trim().toLowerCase()).filter(Boolean) : DEFAULT_ALLOWED_SOURCES
}
function sourceAllowed(source, directNames) {
  if (directNames.has(source)) return true
  const name = source.toLowerCase()
  return allowedSources().some(a => name.startsWith(a))
}
const CAR_WORDS = /mobil|\bcar\b|\bcars\b|otomotif|\bEV\b|listrik|hybrid|\bSUV\b|\bMPV\b|hatchback|sedan|crossover|\bBYD\b|\bLCGC\b|\bvehicle\b/i

function bingQueries() {
  if ((process.env.NEWS_BING || '').toLowerCase() === 'off') return []
  return process.env.NEWS_BING_QUERIES ? process.env.NEWS_BING_QUERIES.split(';').map(q => q.trim()).filter(Boolean) : DEFAULT_BING_QUERIES
}

async function fromBing(query) {
  const url = `https://www.bing.com/news/search?q=${encodeURIComponent(query)}&format=rss&setmkt=id-ID&setlang=id&qft=${encodeURIComponent('sortbydate="1"')}`
  const { body } = await safeFetch(url, { maxBytes: 1024 * 1024, accept: 'application/rss+xml, application/xml;q=0.9, */*;q=0.5' })
  const items = []
  for (const m of body.toString('utf-8').matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = m[1]
    const wrapped = decodeEntities(tagText(block, 'link'))
    let link = null
    try { link = new URL(wrapped).searchParams.get('url') } catch { /* skip */ }
    if (!link || !/^https?:\/\//.test(link)) continue

    const title = plainText(tagText(block, 'title'))
    const summary = clip(plainText(tagText(block, 'description')), 360)
    const text = `${title} ${summary}`
    if (!title || MOTORCYCLE.test(text) || !CAR_WORDS.test(text)) continue

    const image = decodeEntities(tagText(block, 'News:Image'))
    const date = new Date(tagText(block, 'pubDate'))
    const source = plainText(tagText(block, 'News:Source')).replace(/ on MSN$/i, '') || 'News'
    if (!sourceAllowed(source, new Set())) continue
    items.push({
      title,
      summary,
      link,
      source,
      lang: 'id',
      publishedAt: isNaN(date) ? new Date().toISOString() : date.toISOString(),
      imageUrl: image ? `${image}&w=960&h=540&c=14` : null
    })
  }
  return items
}

// ---- Image storage ----
const idFor = (link) => crypto.createHash('sha1').update(link).digest('hex').slice(0, 12)
const imagePath = (id) => path.join(IMAGE_DIR, `${id}.webp`)

async function storeImage(id, imageUrl) {
  if (fs.existsSync(imagePath(id))) return true
  try {
    const { body, contentType } = await safeFetch(imageUrl, { maxBytes: 8 * 1024 * 1024, accept: 'image/*' })
    if (contentType && !contentType.startsWith('image/')) return false
    await sharp(body).rotate().resize({ width: 960, withoutEnlargement: true }).webp({ quality: 78 }).toFile(imagePath(id))
    return true
  } catch (err) {
    console.warn(`[NEWS] Image skipped (${imageUrl}): ${err.message}`)
    return false
  }
}

async function mapPool(list, limit, fn) {
  const results = new Array(list.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (next < list.length) {
      const i = next++
      results[i] = await fn(list[i], i)
    }
  }))
  return results
}

// ---- Refresh job ----
let refreshing = null

export function loadNews() {
  try {
    const data = JSON.parse(fs.readFileSync(NEWS_FILE, 'utf-8'))
    return { updatedAt: data.updatedAt || null, items: data.items || [], failed: data.failed || {} }
  } catch {
    return { updatedAt: null, items: [], failed: {} }
  }
}

async function doRefresh() {
  const previous = loadNews()
  const tasks = [
    ...feedConfig().map(f => ({ name: f.name, run: () => fromFeed(f) })),
    { name: 'NewsData.io', run: fromNewsData },
    ...bingQueries().map(q => ({ name: 'Bing', run: () => fromBing(q) }))
  ]
  const results = await mapPool(tasks, 5, (t) => t.run().then(
    (items) => ({ status: 'fulfilled', value: { name: t.name, items } }),
    (reason) => ({ status: 'rejected', reason })
  ))

  const candidates = []
  const summary = new Map()
  results.forEach((r, i) => {
    if (r.status === 'rejected') {
      console.warn(`[NEWS] Source failed: ${r.reason?.message || r.reason}`)
      return
    }
    const items = r.value.items
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
      .slice(0, MAX_PER_SOURCE_PER_RUN)
    if (items.length) summary.set(r.value.name, (summary.get(r.value.name) || 0) + items.length)
    candidates.push(...items)
  })

  // Existing archive, keyed by id and by normalised title (same story syndicated twice)
  const known = new Map(previous.items.map(i => [i.id, i]))
  const titleKey = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const seenTitles = new Set(previous.items.map(i => titleKey(i.title)))
  const failed = { ...previous.failed }
  const retryAfter = Date.now() - 24 * 60 * 60 * 1000

  const fresh = []
  for (const item of candidates.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))) {
    const id = idFor(item.link)
    const key = titleKey(item.title)
    if (known.has(id) || seenTitles.has(key)) continue
    if (!item.imageUrl || (failed[id] && failed[id] > retryAfter)) continue
    if (!isRelevant(item)) continue
    seenTitles.add(key)
    fresh.push({ ...item, id })
    if (fresh.length >= MAX_NEW_PER_RUN) break
  }

  const stored = await mapPool(fresh, IMAGE_CONCURRENCY, async (item) => {
    const ok = await storeImage(item.id, item.imageUrl)
    if (!ok) failed[item.id] = Date.now()
    return ok
  })

  const added = fresh.filter((_, i) => stored[i]).map(({ imageUrl, ...item }) => ({
    ...item,
    image: `/news-img/${item.id}.webp`,
    ...classify(item)
  }))

  // Merge, re-tag (so classifier updates apply to old stories), expire and cap the archive
  const cutoff = Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000
  const directNames = new Set(feedConfig().map(f => f.name))
  const items = [...added, ...previous.items]
    .filter(i => new Date(i.publishedAt).getTime() >= cutoff && fs.existsSync(imagePath(i.id)) && !MOTORCYCLE.test(`${i.title} ${i.summary}`) && sourceAllowed(i.source, directNames) && isRelevant(i))
    .map(i => ({ ...i, ...classify(i) }))
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, MAX_ITEMS)

  // Never wipe a good archive because every source was unreachable
  if (!items.length) {
    console.warn('[NEWS] Refresh produced no items; keeping the previous archive')
    return previous
  }

  for (const [id, t] of Object.entries(failed)) if (t < retryAfter) delete failed[id]
  const digest = { updatedAt: new Date().toISOString(), items, failed }
  fs.writeFileSync(`${NEWS_FILE}.tmp`, JSON.stringify(digest))
  fs.renameSync(`${NEWS_FILE}.tmp`, NEWS_FILE)

  const keep = new Set(items.map(i => `${i.id}.webp`))
  for (const file of fs.readdirSync(IMAGE_DIR)) {
    if (!keep.has(file)) fs.rmSync(path.join(IMAGE_DIR, file), { force: true })
  }
  console.log(`[NEWS] Refreshed: +${added.length} new, ${items.length} in archive (${[...summary].map(([n, c]) => `${n}:${c}`).join(', ')})`)
  return digest
}

export function refreshNews() {
  refreshing ||= doRefresh().finally(() => { refreshing = null })
  return refreshing
}

// Refresh on startup when the archive is missing/stale, then re-check hourly.
export function startNewsScheduler() {
  const check = () => {
    const { updatedAt } = loadNews()
    if (!updatedAt || Date.now() - new Date(updatedAt).getTime() >= REFRESH_MS) {
      refreshNews().catch(err => console.warn('[NEWS] Refresh failed:', err.message))
    }
  }
  check()
  setInterval(check, 60 * 60 * 1000).unref()
}

// ---- Public read API ----
const TOPICS = ['budget', 'tips', 'ev', 'launch', 'review']
const strip = ({ link, failed, ...rest }) => rest

function matchesQuery(item, q) {
  if (!q) return true
  const hay = `${item.title} ${item.summary} ${item.source}`.toLowerCase()
  return q.toLowerCase().split(/\s+/).filter(Boolean).every(word => hay.includes(word))
}

export function listNews({ page, pageSize, topic, model, q } = {}) {
  const { updatedAt, items } = loadNews()
  const query = String(q || '').trim().slice(0, 80)
  const searched = items.filter(i => matchesQuery(i, query))

  const byTopic = TOPICS.includes(topic) ? searched.filter(i => i.tags?.includes(topic)) : searched
  const counts = { all: searched.length }
  for (const t of TOPICS) counts[t] = searched.filter(i => i.tags?.includes(t)).length
  const models = WATCHLIST
    .map(w => ({ label: w.label, count: byTopic.filter(i => i.models?.includes(w.label)).length }))
    .filter(m => m.count > 0)

  const filtered = WATCHLIST.some(w => w.label === model) ? byTopic.filter(i => i.models?.includes(model)) : byTopic

  const size = Math.min(48, Math.max(1, Number(pageSize) || 12))
  const totalPages = Math.max(1, Math.ceil(filtered.length / size))
  const current = Math.min(totalPages, Math.max(1, Number(page) || 1))
  return {
    updatedAt,
    archiveTotal: items.length,
    sources: new Set(items.map(i => i.source)).size,
    page: current,
    pageSize: size,
    total: filtered.length,
    totalPages,
    counts,
    models,
    items: filtered.slice((current - 1) * size, current * size).map(strip)
  }
}

// "Value picks": recent stories that match what budget-minded Indonesian buyers look for
export function valuePicks(limit = 4) {
  const { items } = loadNews()
  const now = Date.now()
  const scored = items
    .map(i => {
      const ageDays = (now - new Date(i.publishedAt).getTime()) / 86400000
      const score =
        (i.tags?.includes('indonesia') ? 3 : 0) +
        (i.tags?.includes('budget') ? 3 : 0) +
        (i.models?.length ? 2 : 0) +
        (i.tags?.includes('launch') || i.tags?.includes('review') ? 1 : 0) +
        Math.max(0, 3 - ageDays * 0.4)
      return { i, score, ageDays }
    })
    .filter(s => s.ageDays <= 21 && s.score >= 5 && (s.i.tags?.includes('budget') || s.i.models?.length))
    .sort((a, b) => b.score - a.score)

  const picks = []
  const perSource = new Map()
  for (const { i } of scored) {
    if ((perSource.get(i.source) || 0) >= 2) continue
    perSource.set(i.source, (perSource.get(i.source) || 0) + 1)
    picks.push(strip(i))
    if (picks.length >= limit) break
  }
  return picks
}

export function getNewsItem(id) {
  return loadNews().items.find(i => i.id === id) || null
}

export function newsImageFile(name) {
  if (!/^[a-f0-9]{12}\.webp$/.test(name)) return null
  const file = path.join(IMAGE_DIR, name)
  return fs.existsSync(file) ? file : null
}
