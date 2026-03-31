import { useSyncExternalStore } from 'react'
import { getEventLog, onEventLogChange } from '../agents/events'

export function EventFeed() {
  const events = useSyncExternalStore(onEventLogChange, getEventLog)
  // eslint-disable-next-line react-hooks/purity -- reading current time for age display is intentional
  const now = Date.now()

  if (events.length === 0) return null

  return (
    <div className="mb-3">
      <p className="text-[9px] font-mono text-[#e94560] font-bold mb-1 px-1">EVENTS</p>
      <div className="max-h-[120px] overflow-y-auto space-y-1">
        {events.slice(0, 8).map((e) => {
          const age = Math.floor((now - e.timestamp) / 1000)
          const ageStr = age < 60 ? `${age}s` : `${Math.floor(age / 60)}m`
          return (
            <div
              key={e.id}
              className="px-2 py-1 bg-[#1a2744] rounded text-[8px] font-mono flex items-start gap-1.5"
            >
              <span className="text-[10px] shrink-0">{e.icon}</span>
              <span className="text-[#b0b0c0] flex-1">{e.message}</span>
              <span className="text-[#555] shrink-0">{ageStr}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
