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
    const glassBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.62)'
    const glassShadow = isDark
      ? '0 4px 32px rgba(0,0,0,0.45), 0 1px 0 rgba(255,255,255,0.04) inset'
      : '0 4px 24px rgba(100,120,180,0.1), 0 1px 0 rgba(255,255,255,0.8) inset'

    return createTheme({
      shape: { borderRadius: 14 },
      palette: {
        mode,
        background: {
          default: 'transparent',
          paper: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.58)',
        },
        primary: { main: '#3b82f6' },
        error: { main: '#ef4444' },
        success: { main: '#22c55e' },
        divider: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(200,210,240,0.55)',
        text: {
          primary: isDark ? '#f5f5f7' : '#1d1d1f',
          secondary: isDark ? '#98989d' : '#6e6e73',
        },
      },
      typography: {
        fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif',
        h6: { fontWeight: 700, letterSpacing: '-0.02em' },
        subtitle1: { fontWeight: 700, letterSpacing: '-0.02em' },
        subtitle2: { fontWeight: 600, letterSpacing: '-0.01em' },
        body1: { letterSpacing: '-0.01em' },
        body2: { letterSpacing: '-0.01em' },
        button: { letterSpacing: '-0.01em' },
        caption: { letterSpacing: '0em' },
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
              fontFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
            },
          },
        },
        MuiPaper: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `1px solid ${glassBorder}`,
              boxShadow: glassShadow,
              borderRadius: '20px',
            },
          },
        },
        MuiAppBar: {
          styleOverrides: {
            root: {
              backgroundImage: 'none',
              backgroundColor: isDark ? 'rgba(8,8,24,0.65)' : 'rgba(255,255,255,0.5)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
              borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.65)'}`,
              boxShadow: 'none',
            },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              backgroundImage: 'none',
              backgroundColor: isDark ? 'rgba(12,12,30,0.88)' : 'rgba(242,246,255,0.85)',
              backdropFilter: 'blur(32px)',
              WebkitBackdropFilter: 'blur(32px)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.72)'}`,
              boxShadow: isDark ? '0 20px 60px rgba(0,0,0,0.7)' : '0 20px 60px rgba(80,100,180,0.18)',
              borderRadius: '24px',
            },
          },
        },
        MuiMenu: {
          styleOverrides: {
            paper: {
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              borderRadius: '16px',
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              borderRadius: '12px',
              letterSpacing: '-0.01em',
            },
            contained: {
              boxShadow: 'none',
              '&:hover': { boxShadow: 'none' },
              '&:active': { boxShadow: 'none' },
            },
            outlined: {
              borderWidth: '1.5px',
              '&:hover': { borderWidth: '1.5px' },
            },
            sizeSmall: { borderRadius: '10px', fontSize: '0.8rem' },
            sizeLarge: { borderRadius: '14px', paddingTop: '12px', paddingBottom: '12px' },
          },
        },
        MuiToggleButton: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 500,
              border: '1px solid',
              letterSpacing: '-0.01em',
            },
          },
        },
        MuiToggleButtonGroup: {
          styleOverrides: {
            root: { borderRadius: '12px', overflow: 'hidden' },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { borderRadius: '8px', fontWeight: 600, letterSpacing: '-0.01em' },
          },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: { borderRadius: '12px' },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: { borderRadius: '12px' },
          },
        },
        MuiLinearProgress: {
          styleOverrides: {
            root: { borderRadius: '8px' },
            bar: { borderRadius: '8px' },
          },
        },
        MuiListItemButton: {
          styleOverrides: {
            root: { borderRadius: '12px' },
          },
        },
        MuiDivider: {
          styleOverrides: {
            root: {
              borderColor: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(200,210,240,0.5)',
            },
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
