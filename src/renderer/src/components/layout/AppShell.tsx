import { type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppBar, Box, IconButton, Toolbar, Typography, Button } from '@mui/material'
import SettingsIcon from '@mui/icons-material/Settings'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
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
  const { cudaAvailable, isReady, usageType, usagePercent } = useBackendStore()
  const isProjectPage = location.pathname.startsWith('/project/')

  const chipColor = cudaAvailable ? '#22c55e' : '#60a5fa'
  const chipBg = cudaAvailable ? 'rgba(34,197,94,0.12)' : 'rgba(96,165,250,0.12)'
  const chipBorder = cudaAvailable ? 'rgba(34,197,94,0.28)' : 'rgba(96,165,250,0.28)'
  const chipLabel =
    usageType === 'gpu'
      ? `GPU${usagePercent !== null ? ` ${usagePercent}%` : ''}`
      : `CPU${usagePercent !== null ? ` ${usagePercent}%` : ''}`

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar position="static" elevation={0} sx={{ color: 'text.primary' }}>
        <Toolbar variant="dense" sx={{ minHeight: 48, px: 2 }}>
          {isProjectPage ? (
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/')}
              size="small"
              color="inherit"
              sx={{ textTransform: 'none' }}
            >
              목록
            </Button>
          ) : (
            <Typography variant="subtitle1" fontWeight="bold">
              Whisper App
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {isReady && usageType !== null && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                backgroundColor: chipBg,
                border: `1px solid ${chipBorder}`,
                borderRadius: '20px',
                px: 1.5,
                py: 0.35,
                mr: 1.5
              }}
            >
              <Box
                sx={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  bgcolor: chipColor,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${chipColor}`
                }}
              />
              <Typography
                variant="caption"
                sx={{
                  color: chipColor,
                  fontWeight: 700,
                  fontSize: '0.65rem',
                  lineHeight: 1,
                  letterSpacing: '0.02em'
                }}
              >
                {chipLabel}
              </Typography>
            </Box>
          )}
          <IconButton onClick={openSettings} size="small" color="inherit" title="설정">
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box component="main" sx={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </Box>

      <SettingsModal />
    </Box>
  )
}
