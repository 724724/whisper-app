import { type ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AppBar, Box, Chip, IconButton, Toolbar, Typography, Button } from '@mui/material'
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
  const { cudaAvailable, gpuName } = useBackendStore()
  const isProjectPage = location.pathname.startsWith('/project/')

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <AppBar
        position="static"
        elevation={0}
        sx={{ color: 'text.primary' }}
      >
        <Toolbar variant="dense" sx={{ minHeight: 48, px: 2 }}>
          {isProjectPage ? (
            <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/')} size="small" color="inherit" sx={{ textTransform: 'none' }}>
              목록
            </Button>
          ) : (
            <Typography variant="subtitle1" fontWeight="bold">Whisper App</Typography>
          )}
          <Box sx={{ flex: 1 }} />
          {cudaAvailable && (
            <Chip label={`GPU${gpuName ? ` · ${gpuName}` : ''}`} color="success" size="small" sx={{ mr: 1, fontSize: '0.7rem' }} />
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
