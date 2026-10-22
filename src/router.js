import { reactive } from 'vue'

// Tiny path router for the public pages. Only /news/:id exists besides the home page; the
// vault itself never touches the URL (see vaultStore.pushNav).
const NEWS_PATH = /^\/news\/([a-f0-9]{12})\/?$/

function parse() {
  const m = location.pathname.match(NEWS_PATH)
  return m ? { name: 'news', id: m[1] } : { name: 'home', id: null }
}

export const route = reactive(parse())
let homeScrollY = 0

function sync() {
  Object.assign(route, parse())
}

export function openNews(id) {
  homeScrollY = window.scrollY
  history.pushState({ news: id }, '', `/news/${id}`)
  sync()
  window.scrollTo(0, 0)
}

export function backToHome() {
  if (history.state?.news) history.back()
  else {
    history.pushState({}, '', '/')
    sync()
  }
}

export function onRoutePop() {
  const wasNews = route.name === 'news'
  sync()
  // Returning from an article: put the reader back where they were on the home page
  if (wasNews && route.name === 'home') requestAnimationFrame(() => window.scrollTo(0, homeScrollY))
  else if (route.name === 'news') window.scrollTo(0, 0)
}
