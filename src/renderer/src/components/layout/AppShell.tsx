import { type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSettingsStore } from '../../store/settingsStore'
import { useBackendStore } from '../../store/backendStore'
import { SettingsModal } from '../settings/SettingsModal'

interface AppShellProps {
  children: ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const openSettings = useSettingsStore((s) => s.openSettings)
  const { cudaAvailable, gpuName } = useBackendStore()

  const isProjectPage = location.pathname.startsWith('/project/')

  return (
    <div className="flex flex-col h-screen bg-zinc-950 text-white">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          {isProjectPage && (
            <button
              onClick={() => navigate('/')}
              className="text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm"
            >
              ← 목록
            </button>
          )}
          {!isProjectPage && (
            <span className="font-semibold text-white text-base">Whisper App</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {cudaAvailable && (
            <span className="text-xs text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
              GPU {gpuName ? `· ${gpuName}` : ''}
            </span>
          )}
          <button
            onClick={openSettings}
            className="text-zinc-400 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-zinc-800"
            title="설정"
          >
            ⚙
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>

      <SettingsModal />
    </div>
  )
}
