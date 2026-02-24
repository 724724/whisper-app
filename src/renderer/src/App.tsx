import { HashRouter, Routes, Route } from 'react-router-dom'
import { useEffect, useState, useMemo } from 'react'
import { ThemeProvider, createTheme, CssBaseline } from '@mui/material'
import { AppShell } from './components/layout/AppShell'
import { SetupScreen } from './components/setup/SetupScreen'
import { HomePage } from './pages/HomePage'
import { ProjectPage } from './pages/ProjectPage'
import { useBackendStore } from './store/backendStore'
import { useBackendInit } from './hooks/useBackend'
import { useSettingsStore } from './store/settingsStore'

function useSystemDark() {
  const [isDark, setIsDark] = useState(() =>
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDark
}

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
  const theme = useSettingsStore((s) => s.settings.theme)
  const systemDark = useSystemDark()

  useBackendInit()

  useEffect(() => {
    window.api.getSettings().then(setSettings).catch(() => {})
  }, [setSettings])

  const mode: 'dark' | 'light' =
    theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  const muiTheme = useMemo(() => {
    const isDark = mode === 'dark'
    const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.6)'
    const glassShadow = isDark
      ? '0 4px 32px rgba(0,0,0,0.5)'
      : '0 4px 24px rgba(100,120,180,0.12)'

    return createTheme({
      palette: {
        mode,
        background: {
          default: 'transparent',
          paper: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.55)',
        },
        primary: { main: '#3b82f6' },
        error: { main: '#ef4444' },
        success: { main: '#22c55e' },
        divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(200,210,240,0.5)',
        text: {
          primary: isDark ? '#ffffff' : '#09090b',
          secondary: isDark ? '#a1a1aa' : '#52525b',
        },
      },
      typography: {
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            'html, body, #root': {
              minHeight: '100vh',
              background: isDark
                ? 'linear-gradient(135deg, #080818 0%, #0f1628 45%, #0d1520 100%)'
                : 'linear-gradient(135deg, #dce8f8 0%, #e8eeff 45%, #f0f4ff 100%)',
              backgroundAttachment: 'fixed',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              border: `1px solid ${glassBorder}`,
              boxShadow: glassShadow,
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: isDark ? 'rgba(8,8,24,0.6)' : 'rgba(255,255,255,0.45)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.6)'}`,
              boxShadow: 'none',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundImage: 'none',
              backgroundColor: isDark ? 'rgba(10,10,28,0.85)' : 'rgba(240,246,255,0.82)',
              backdropFilter: 'blur(28px)',
              WebkitBackdropFilter: 'blur(28px)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.7)'}`,
              boxShadow: isDark ? '0 8px 48px rgba(0,0,0,0.6)' : '0 8px 32px rgba(100,120,180,0.2)',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
            },
          },
        },
        MuiButton: { defaultProps: { disableElevation: true } },
        MuiToggleButton: {
          styleOverrides: {
            root: { textTransform: 'none', border: '1px solid' },
          },
        },
      },
    })
  }, [mode])

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      {isReady ? <AppRoutes /> : <SetupScreen />}
    </ThemeProvider>
  )
}
