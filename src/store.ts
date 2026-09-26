import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { PoolId, SubelementId } from './data/pool'
import type { Badge } from './game/badges'
import { dateKey } from './game/dates'
import type { Rank } from './game/progression'
import * as game from './game/save'

export type Screen = 'base' | 'study' | 'boss' | 'skills' | 'badges' | 'log'
export type Focus = SubelementId | 'all'

export type Toast = { id: number; kind: 'badge' | 'rank'; title: string; body: string }

type State = {
  save: game.Save
  screen: Screen
  focus: Focus
  toasts: Toast[]
  go: (screen: Screen, focus?: Focus) => void
  setFocus: (focus: Focus) => void
  setPool: (pool: PoolId) => void
  tick: () => void
  answerStudy: (id: string, choice: number) => game.AnswerOutcome
  startBoss: () => void
  answerBoss: (index: number, choice: number | null) => void
  abandonBoss: () => void
  submitBoss: () => game.BossOutcome
  importSave: (json: string) => void
  resetSave: () => void
  dismissToast: (id: number) => void
}

export const today = () => dateKey(new Date())

let toastId = 0
function toastsFor(earned: Badge[], rankUp: Rank | null): Toast[] {
  const out: Toast[] = earned.map((b) => ({ id: ++toastId, kind: 'badge', title: `BADGE EARNED: ${b.name.toUpperCase()}`, body: b.description }))
  if (rankUp) out.unshift({ id: ++toastId, kind: 'rank', title: `RANK UP: ${rankUp.name.toUpperCase()}`, body: rankUp.flavor })
  return out
}

export const useGame = create<State>()(
  persist(
    (set, get) => ({
      save: game.newSave(today()),
      screen: 'base',
      focus: 'all',
      toasts: [],
      go: (screen, focus) => set((s) => ({ screen, focus: focus ?? s.focus })),
      setFocus: (focus) => set({ focus }),
      setPool: (pool) => set((s) => ({ save: game.setPool(s.save, pool), focus: 'all' })),
      tick: () => {
        const r = game.tick(get().save, today())
        if (r.save !== get().save) set((s) => ({ save: r.save, toasts: [...s.toasts, ...toastsFor(r.earned, null)] }))
      },
      answerStudy: (id, choice) => {
        const r = game.answerStudy(get().save, id, choice, today(), Math.random)
        set((s) => ({ save: r.save, toasts: [...s.toasts, ...toastsFor(r.outcome.earned, r.outcome.rankUp)] }))
        return r.outcome
      },
      startBoss: () => set((s) => ({ save: game.startBoss(s.save, today(), Math.random) })),
      answerBoss: (index, choice) => set((s) => ({ save: game.answerBoss(s.save, index, choice) })),
      abandonBoss: () => set((s) => ({ save: game.abandonBoss(s.save) })),
      submitBoss: () => {
        const r = game.submitBoss(get().save, today(), Math.random)
        set((s) => ({ save: r.save, toasts: [...s.toasts, ...toastsFor(r.outcome.earned, r.outcome.rankUp)] }))
        return r.outcome
      },
      importSave: (json) => {
        set({ save: game.parseSave(json) })
        get().tick()
      },
      resetSave: () => set({ save: game.newSave(today()), screen: 'base', focus: 'all' }),
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    }),
    {
      name: 'wasteland-net-save',
      version: game.SAVE_VERSION,
      partialize: (s) => ({ save: s.save }),
      migrate: (persisted) => {
        const p = persisted as { save: unknown }
        return { save: game.migrateSave(p.save) }
      },
    },
  ),
)
