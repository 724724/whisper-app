import { HashRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { SetupScreen } from './components/setup/SetupScreen'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { useBackendStore } from './store/backendStore'
import { useBackendInit } from './hooks/useBackend'
import { useSettingsStore } from './store/settingsStore'
import { useTheme } from './hooks/useTheme'

function AppRoutes() {
  return (
    <HashRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/project/:id" element={<ProjectPage />} />
        </Routes>
      </AppShell>
    </HashRouter>
  )
}

export default function App() {
  const isReady = useBackendStore((s) => s.isReady)
  const setSettings = useSettingsStore((s) => s.setSettings)

  // Subscribe to backend status IPC events
  useBackendInit()

  // Apply theme class to <html> based on settings
  useTheme()

  // Load settings on startup
  useEffect(() => {
    window.api.getSettings().then(setSettings).catch(() => {})
  }, [setSettings])

  if (!isReady) {
    return <SetupScreen />
  }

  return <AppRoutes />
}
