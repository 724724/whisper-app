import { useState, useEffect, useCallback, type ReactNode } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Box,
  Button,
  TextField,
  Typography,
  FormControl,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Divider,
  IconButton,
  Paper,
  Switch
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useSettingsStore } from '../../store/settingsStore'
import type { AppSettings, WhisperModelName } from '@shared/types'

const TRANSCRIBE_LANGS = [
  { code: '', label: '자동 감지 (Auto)' },
  { code: 'en', label: '영어 (English)' },
  { code: 'ko', label: '한국어 (Korean)' },
  { code: 'ja', label: '일본어 (Japanese)' },
  { code: 'zh', label: '중국어 (Chinese)' },
  { code: 'fr', label: '프랑스어 (French)' },
  { code: 'de', label: '독일어 (German)' },
  { code: 'es', label: '스페인어 (Spanish)' },
  { code: 'ru', label: '러시아어 (Russian)' },
  { code: 'pt', label: '포르투갈어 (Portuguese)' },
  { code: 'ar', label: '아랍어 (Arabic)' },
  { code: 'hi', label: '힌디어 (Hindi)' },
]

const MODELS: { name: WhisperModelName; label: string; size: string }[] = [
  { name: 'tiny', label: 'Tiny', size: '75 MB' },
  { name: 'base', label: 'Base', size: '145 MB' },
  { name: 'small', label: 'Small', size: '466 MB' },
  { name: 'medium', label: 'Medium', size: '1.5 GB' },
  { name: 'large-v2', label: 'Large v2', size: '2.9 GB' },
  { name: 'large-v3', label: 'Large v3', size: '2.9 GB' }
]

const TARGET_LANGS = [
  { code: 'KO', label: '한국어' },
  { code: 'EN-US', label: '영어 (미국)' },
  { code: 'JA', label: '일본어' },
  { code: 'ZH', label: '중국어 (간체)' },
  { code: 'DE', label: '독일어' },
  { code: 'FR', label: '프랑스어' }
]

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      variant="caption"
      sx={{
        display: 'block',
        color: 'text.secondary',
        fontWeight: 600,
        fontSize: '0.7rem',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        px: 1.5,
        mb: 0.75,
        mt: 0.5
      }}
    >
      {children}
    </Typography>
  )
}

function SettingsGroup({ children }: { children: ReactNode }) {
  return (
    <Paper variant="outlined" sx={{ borderRadius: '14px', overflow: 'hidden', boxShadow: 'none' }}>
      {children}
    </Paper>
  )
}

interface SettingsRowProps {
  label: string
  hint?: string
  children: ReactNode
  last?: boolean
}

function SettingsRow({ label, hint, children, last }: SettingsRowProps) {
  return (
    <>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 1.4,
          gap: 2
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, whiteSpace: 'nowrap' }}>
            {label}
          </Typography>
          {hint && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.2 }}>
              {hint}
            </Typography>
          )}
        </Box>
        <Box sx={{ flexShrink: 0 }}>{children}</Box>
      </Box>
      {!last && <Divider />}
    </>
  )
}

export function SettingsModal() {
  const { isOpen, closeSettings, settings, setSettings } = useSettingsStore()
  const [form, setForm] = useState<AppSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    setForm(settings)
  }, [settings, isOpen])

  const loadAudioDevices = useCallback(async () => {
    try {
      // enumerateDevices requires a prior getUserMedia grant to get labels
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
    } catch {
      // ignore
    }
  }, [])

  useEffect(() => {
    if (isOpen) loadAudioDevices()
  }, [isOpen, loadAudioDevices])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await window.api.setSettings(form)
      setSettings(updated)
      closeSettings()
    } finally {
      setIsSaving(false)
    }
  }

  const selectSx = {
    borderRadius: '10px',
    fontSize: '0.85rem',
    '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
    bgcolor: 'action.hover',
    minWidth: 150
  }

  return (
    <Dialog open={isOpen} onClose={closeSettings} maxWidth="xs" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1,
          fontWeight: 700,
          fontSize: '1.1rem',
          letterSpacing: '-0.02em'
        }}
      >
        설정
        <IconButton size="small" onClick={closeSettings} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5, pb: 1 }}>
        {/* DeepL 설정 */}
        <Box>
          <SectionLabel>DeepL 번역</SectionLabel>
          <SettingsGroup>
            <Box sx={{ px: 2, py: 1.25 }}>
              <TextField
                type="password"
                value={form.deeplApiKey}
                onChange={(e) => setForm((f) => ({ ...f, deeplApiKey: e.target.value }))}
                placeholder="xxxx-xxxx-xxxx:fx"
                size="small"
                fullWidth
                variant="standard"
                InputProps={{ disableUnderline: true, sx: { fontSize: '0.85rem' } }}
                sx={{ '& .MuiInputBase-root': { bgcolor: 'transparent' } }}
              />
            </Box>
            <Divider />
            <Box sx={{ display: 'flex', px: 2, py: 1 }}>
              <ToggleButtonGroup
                value={form.deeplApiType}
                exclusive
                size="small"
                onChange={(_, v) => {
                  if (v) setForm((f) => ({ ...f, deeplApiType: v as 'free' | 'pro' }))
                }}
                sx={{
                  '& .MuiToggleButton-root': {
                    px: 2.5,
                    py: 0.5,
                    fontSize: '0.8rem',
                    fontWeight: 600
                  }
                }}
              >
                <ToggleButton value="free">Free</ToggleButton>
                <ToggleButton value="pro">Pro</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </SettingsGroup>
        </Box>

        {/* Whisper 설정 */}
        <Box>
          <SectionLabel>Whisper 모델</SectionLabel>
          <SettingsGroup>
            <SettingsRow label="모델" hint="GPU 사용 시 large-v3 권장">
              <FormControl size="small">
                <Select
                  value={form.whisperModel}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, whisperModel: e.target.value as WhisperModelName }))
                  }
                  sx={selectSx}
                >
                  {MODELS.map((m) => (
                    <MenuItem key={m.name} value={m.name} sx={{ fontSize: '0.85rem' }}>
                      {m.label}{' '}
                      <Typography
                        component="span"
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: 0.5 }}
                      >
                        ({m.size})
                      </Typography>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingsRow>
            <SettingsRow label="전사 언어" hint="Auto는 Whisper가 자동 감지" last>
              <FormControl size="small">
                <Select
                  value={form.transcribeLanguage}
                  onChange={(e) => setForm((f) => ({ ...f, transcribeLanguage: e.target.value }))}
                  sx={selectSx}
                >
                  {TRANSCRIBE_LANGS.map((l) => (
                    <MenuItem key={l.code} value={l.code} sx={{ fontSize: '0.85rem' }}>
                      {l.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingsRow>
          </SettingsGroup>
        </Box>

        {/* 번역 설정 */}
        <Box>
          <SectionLabel>번역</SectionLabel>
          <SettingsGroup>
            <SettingsRow label="대상 언어" last>
              <FormControl size="small">
                <Select
                  value={form.outputLanguage}
                  onChange={(e) => setForm((f) => ({ ...f, outputLanguage: e.target.value }))}
                  sx={selectSx}
                >
                  {TARGET_LANGS.map((l) => (
                    <MenuItem key={l.code} value={l.code} sx={{ fontSize: '0.85rem' }}>
                      {l.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingsRow>
          </SettingsGroup>
        </Box>

        {/* 마이크 설정 */}
        <Box>
          <SectionLabel>마이크 (실시간 전사)</SectionLabel>
          <SettingsGroup>
            <SettingsRow label="강의 성능 모드" hint="음량 증폭 + 중고음 EQ (강의실 환경 최적화)">
              <Switch
                checked={form.realtimeEnhance}
                onChange={(e) => setForm((f) => ({ ...f, realtimeEnhance: e.target.checked }))}
                size="small"
                color="primary"
              />
            </SettingsRow>
            <SettingsRow label="입력 장치" last>
              <FormControl size="small">
                <Select
                  value={form.audioDeviceId}
                  onChange={(e) => setForm((f) => ({ ...f, audioDeviceId: e.target.value }))}
                  sx={{ ...selectSx, minWidth: 180 }}
                  displayEmpty
                >
                  <MenuItem value="" sx={{ fontSize: '0.85rem' }}>
                    시스템 기본값
                  </MenuItem>
                  {audioDevices.map((d) => (
                    <MenuItem key={d.deviceId} value={d.deviceId} sx={{ fontSize: '0.85rem' }}>
                      {d.label || `마이크 ${d.deviceId.slice(0, 6)}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </SettingsRow>
          </SettingsGroup>
        </Box>

        {/* 테마 설정 */}
        <Box>
          <SectionLabel>테마</SectionLabel>
          <SettingsGroup>
            <Box sx={{ px: 2, py: 1.25 }}>
              <ToggleButtonGroup
                value={form.theme}
                exclusive
                size="small"
                fullWidth
                onChange={(_, v) => {
                  if (v !== null) setForm((f) => ({ ...f, theme: v }))
                }}
                sx={{
                  borderRadius: '10px',
                  overflow: 'hidden',
                  '& .MuiToggleButton-root': {
                    py: 0.75,
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    flex: 1
                  }
                }}
              >
                <ToggleButton value="dark">🌙 다크</ToggleButton>
                <ToggleButton value="light">☀️ 라이트</ToggleButton>
                <ToggleButton value="system">💻 시스템</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </SettingsGroup>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, pt: 1 }}>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={isSaving}
          fullWidth
          size="large"
          sx={{ borderRadius: '14px', fontWeight: 700, fontSize: '0.95rem' }}
        >
          {isSaving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
