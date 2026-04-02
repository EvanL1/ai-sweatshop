import { useEffect } from 'react'
import { OfficeCanvas } from './office/OfficeCanvas'
import { Sidebar } from './sidebar/Sidebar'
import { ContextMenu } from './sidebar/ContextMenu'
import { FurnitureContextMenu } from './sidebar/FurnitureContextMenu'
import { useAgentSocket } from './hooks/useAgentSocket'

export default function App() {
  // Connect to bridge server (silently fails if not running)
  useAgentSocket()

  // Disable browser default right-click on canvas
  useEffect(() => {
    const prevent = (e: MouseEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'CANVAS') e.preventDefault()
    }
    document.addEventListener('contextmenu', prevent)
    return () => document.removeEventListener('contextmenu', prevent)
  }, [])

  return (
    <div className="flex h-screen w-screen">
      <aside className="w-[320px] shrink-0 bg-[#16213e] border-r border-[#0f3460] p-4 overflow-y-auto">
        <Sidebar />
      </aside>
      <main className="flex-1 relative bg-[#383850]">
        <OfficeCanvas />
      </main>
      <ContextMenu />
      <FurnitureContextMenu />
    </div>
  )
}
