import { useState, useEffect } from 'react'
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Button, TextField, Typography, FormControl, InputLabel,
  Select, MenuItem, ToggleButtonGroup, ToggleButton, RadioGroup,
  FormControlLabel, Radio, FormLabel,
} from '@mui/material'
import { useSettingsStore } from '../../store/settingsStore'
import type { AppSettings, WhisperModelName } from '../../../../shared/types'

const MODELS: { name: WhisperModelName; label: string; size: string }[] = [
  { name: 'tiny', label: 'Tiny', size: '75 MB' },
  { name: 'base', label: 'Base', size: '145 MB' },
  { name: 'small', label: 'Small', size: '466 MB' },
  { name: 'medium', label: 'Medium', size: '1.5 GB' },
  { name: 'large-v2', label: 'Large v2', size: '2.9 GB' },
  { name: 'large-v3', label: 'Large v3', size: '2.9 GB' },
]

const TARGET_LANGS = [
  { code: 'KO', label: '한국어' },
  { code: 'EN-US', label: '영어 (미국)' },
  { code: 'JA', label: '일본어' },
  { code: 'ZH', label: '중국어 (간체)' },
  { code: 'DE', label: '독일어' },
  { code: 'FR', label: '프랑스어' },
]

export function SettingsModal() {
  const { isOpen, closeSettings, settings, setSettings } = useSettingsStore()
  const [form, setForm] = useState<AppSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings, isOpen])

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

  return (
    <Dialog open={isOpen} onClose={closeSettings} maxWidth="sm" fullWidth>
      <DialogTitle>설정</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3, pt: 1 }}>

          {/* DeepL API Key */}
          <Box>
            <TextField
              label="DeepL API 키"
              type="password"
              value={form.deeplApiKey}
              onChange={(e) => setForm((f) => ({ ...f, deeplApiKey: e.target.value }))}
              placeholder="xxxx-xxxx-xxxx:fx"
              size="small"
              fullWidth
            />
            <RadioGroup
              row
              name="apiType"
              value={form.deeplApiType}
              onChange={(e) => setForm((f) => ({ ...f, deeplApiType: e.target.value as 'free' | 'pro' }))}
              sx={{ mt: 1 }}
            >
              <FormControlLabel value="free" control={<Radio size="small" />} label="Free" />
              <FormControlLabel value="pro" control={<Radio size="small" />} label="Pro" />
            </RadioGroup>
          </Box>

          {/* Whisper Model */}
          <Box>
            <FormControl size="small" fullWidth>
              <InputLabel>Whisper 모델</InputLabel>
              <Select
                label="Whisper 모델"
                value={form.whisperModel}
                onChange={(e) => setForm((f) => ({ ...f, whisperModel: e.target.value as WhisperModelName }))}
              >
                {MODELS.map((m) => (
                  <MenuItem key={m.name} value={m.name}>
                    {m.label} ({m.size})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              NVIDIA GPU 사용 시 large-v3 권장. 첫 사용 시 자동 다운로드됩니다.
            </Typography>
          </Box>

          {/* Translation target language */}
          <FormControl size="small" fullWidth>
            <InputLabel>번역 대상 언어</InputLabel>
            <Select
              label="번역 대상 언어"
              value={form.outputLanguage}
              onChange={(e) => setForm((f) => ({ ...f, outputLanguage: e.target.value }))}
            >
              {TARGET_LANGS.map((l) => (
                <MenuItem key={l.code} value={l.code}>{l.label}</MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Theme */}
          <Box>
            <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>테마</FormLabel>
            <ToggleButtonGroup
              value={form.theme}
              exclusive
              size="small"
              fullWidth
              onChange={(_, v) => { if (v !== null) setForm((f) => ({ ...f, theme: v })) }}
            >
              <ToggleButton value="dark">🌙 다크</ToggleButton>
              <ToggleButton value="light">☀️ 라이트</ToggleButton>
              <ToggleButton value="system">💻 시스템</ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              시스템: OS 설정에 따라 자동 전환
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={closeSettings} color="inherit">취소</Button>
        <Button variant="contained" onClick={handleSave} disabled={isSaving}>
          {isSaving ? '저장 중...' : '저장'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
