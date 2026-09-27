/**
 * Optional usage analytics via a self-hosted Umami instance.
 *
 * Nothing here talks to the network by itself. The container writes
 * /analytics.js at startup (docker/40-umami.sh): with UMAMI_SCRIPT_URL and
 * UMAMI_WEBSITE_ID set it loads the Umami tracker, otherwise it's a no-op.
 * Calls made before the tracker loads are queued; if it never loads (analytics
 * off, blocked, offline) they're dropped and the game is unaffected.
 *
 * Events carry game facts only: never names, free text, or question content.
 */
import type { Screen } from './store'

type Payload = Record<string, string | number | boolean>
type Umami = {
  track: {
    (props: (p: Payload) => Payload): void
    (event: string, data?: Payload): void
  }
}

declare global {
  interface Window {
    umami?: Umami
  }
}

const MAX_QUEUE = 50
const queue: ((u: Umami) => void)[] = []

function run(fn: (u: Umami) => void) {
  try {
    if (window.umami) fn(window.umami)
    else if (queue.length < MAX_QUEUE) queue.push(fn)
  } catch {
    // Analytics must never break the game.
  }
}

export function flushQueue() {
  const u = window.umami
  if (!u) return
  while (queue.length) {
    try {
      queue.shift()!(u)
    } catch {
      // ignore
    }
  }
}

if (typeof window !== 'undefined') window.addEventListener('umami:ready', flushQueue)

const SCREEN_TITLES: Record<Screen, string> = {
  base: 'Base',
  outpost: 'Outpost',
  study: 'Scavenge',
  boss: 'Boss Battle',
  skills: 'Skills',
  badges: 'Badges',
  log: 'Radio Log',
}

/** Screens aren't URLs (no router), so each one is sent as a virtual pageview. */
export function trackScreen(screen: Screen) {
  run((u) => u.track((p) => ({ ...p, url: `/${screen}`, title: `Wasteland Net · ${SCREEN_TITLES[screen]}` })))
}

export function trackEvent(name: string, data?: Payload) {
  run((u) => u.track(name, data))
}

/** Test hook. */
export const _queueLength = () => queue.length
