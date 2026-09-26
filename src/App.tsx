import { useEffect } from 'react'
import { Badges } from './screens/Badges'
import { Base } from './screens/Base'
import { Boss } from './screens/Boss'
import { Log } from './screens/Log'
import { OutpostScreen } from './screens/OutpostScreen'
import { Skills } from './screens/Skills'
import { Study } from './screens/Study'
import { useGame } from './store'
import { StatusBar } from './ui/StatusBar'
import { Toasts } from './ui/Toasts'

export default function App() {
  const screen = useGame((s) => s.screen)
  const lowPower = useGame((s) => s.save.supplies.amount === 0)
  const tick = useGame((s) => s.tick)

  // Supplies decay by calendar day, so re-check on load, every minute, and on return to the tab.
  useEffect(() => {
    tick()
    const id = setInterval(tick, 60_000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tick])

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [screen])

  return (
    <div className={lowPower ? 'low-power' : undefined}>
      <StatusBar />
      {lowPower && (
        <div className="flicker border-b border-rust-dim bg-rust-dim/25 px-4 py-2 text-center text-xs tracking-wider text-rust uppercase" role="status">
          Low power: supplies are exhausted. Log in and answer questions to restock. No progress has been lost.
        </div>
      )}
      <main className="mx-auto max-w-5xl px-4 py-5">
        {screen === 'base' && <Base />}
        {screen === 'outpost' && <OutpostScreen />}
        {screen === 'study' && <Study />}
        {screen === 'boss' && <Boss />}
        {screen === 'skills' && <Skills />}
        {screen === 'badges' && <Badges />}
        {screen === 'log' && <Log />}
      </main>
      <Toasts />
    </div>
  )
}
