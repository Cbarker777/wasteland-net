import { afterEach, describe, expect, it, vi } from 'vitest'
import { _queueLength, flushQueue, trackEvent, trackScreen } from './analytics'

afterEach(() => {
  delete window.umami
})

describe('analytics', () => {
  it('queues calls until the tracker loads, then sends them in order', () => {
    trackScreen('study')
    trackEvent('answer', { pool: 'extra', correct: true })
    expect(_queueLength()).toBe(2)

    const track = vi.fn()
    window.umami = { track }
    window.dispatchEvent(new Event('umami:ready'))

    expect(_queueLength()).toBe(0)
    expect(track).toHaveBeenCalledTimes(2)
    const pageview = track.mock.calls[0][0] as (p: Record<string, unknown>) => Record<string, unknown>
    expect(pageview({ website: 'x' })).toEqual({ website: 'x', url: '/study', title: 'Wasteland Net · Scavenge' })
    expect(track.mock.calls[1]).toEqual(['answer', { pool: 'extra', correct: true }])
  })

  it('sends immediately once loaded', () => {
    const track = vi.fn()
    window.umami = { track }
    trackEvent('build', { structure: 'tower', level: 1 })
    expect(track).toHaveBeenCalledWith('build', { structure: 'tower', level: 1 })
  })

  it('never lets a tracker error reach the game, and caps the queue when analytics is off', () => {
    window.umami = {
      track: () => {
        throw new Error('blocked')
      },
    }
    expect(() => trackEvent('answer')).not.toThrow()
    delete window.umami
    for (let i = 0; i < 200; i++) trackEvent('answer')
    expect(_queueLength()).toBe(50)
    flushQueue() // no tracker: stays queued, no throw
    expect(_queueLength()).toBe(50)
  })
})
