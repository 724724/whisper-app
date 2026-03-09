import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Paper,
  Switch,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import MicIcon from '@mui/icons-material/Mic'
import MicOffIcon from '@mui/icons-material/MicOff'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial'
import GraphicEqIcon from '@mui/icons-material/GraphicEq'
import { useRealtime, type RealtimeSegment } from '../hooks/useRealtime'
import { useSettingsStore } from '../store/settingsStore'
import type { TranscriptSegment } from '@shared/types'

const STATUS_LABEL: Record<string, string> = {
  idle: '대기 중',
  connecting: '연결 중...',
  listening: '발화 감지 중...',
  transcribing: '전사 중...',
  error: '오류'
}

const STATUS_COLOR: Record<string, string> = {
  idle: 'text.disabled',
  connecting: 'primary.main',
  listening: 'success.main',
  transcribing: 'warning.main',
  error: 'error.main'
}

/** Convert realtime segments to TranscriptSegment for export / save */
function toTranscriptSegments(segs: RealtimeSegment[]): TranscriptSegment[] {
  return segs.map((s, i) => ({
    id: s.id,
    startMs: s.startMs,
    endMs: i + 1 < segs.length ? segs[i + 1].startMs : s.startMs + 3000,
    text: s.text,
    translatedText: s.translatedText
  }))
}

export function RealtimePage() {
  const navigate = useNavigate()
  const {
    status,
    segments,
    error,
    isRecording,
    isSpeaking,
    translateMode,
    setTranslateMode,
    start,
    stop,
    clearSegments
  } = useRealtime()

  const settings = useSettingsStore((s) => s.settings)
  const hasDeepL = !!settings.deeplApiKey

  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to newest segment
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [segments])

  const handleToggleRecording = () => {
    if (isRecording) stop()
    else start()
  }

  // ── Export ──────────────────────────────────────────────────────────────
  const canExport = segments.length > 0
  const hasTranslation = segments.some((s) => s.translatedText !== null)

  const handleExport = async (format: 'txt' | 'srt' | 'csv') => {
    if (!canExport) return
    const ts = toTranscriptSegments(segments)
    const name = `realtime-${new Date().toISOString().slice(0, 10)}`
    await window.api.exportTranscript({ segments: ts, projectName: name, format, hasTranslation })
  }

  // ── Save as project ──────────────────────────────────────────────────────
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [projectName, setProjectName] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const openSaveDialog = () => {
    setProjectName(`실시간 전사 ${new Date().toLocaleDateString('ko-KR')}`)
    setSaveDialogOpen(true)
  }

  const handleSaveProject = async () => {
    if (!projectName.trim() || segments.length === 0) return
    setIsSaving(true)
    try {
      const ts = toTranscriptSegments(segments)
      const targetLanguage = translateMode && hasTranslation ? settings.outputLanguage : null
      const result = await window.api.saveRealtimeProject({
        name: projectName.trim(),
        segments: ts,
        language: null,
        modelUsed: settings.whisperModel,
        targetLanguage
      })
      if (result.success && result.project) {
        setSaveDialogOpen(false)
        navigate(`/project/${result.project.id}`)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: 2,
        overflow: 'hidden'
      }}
    >
      {/* ── Control bar ────────────────────────────────────────────────────── */}
      <Paper
        sx={{
          p: 2,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexShrink: 0,
          flexWrap: 'wrap'
        }}
      >
        {/* Start / Stop button */}
        <Button
          variant={isRecording ? 'outlined' : 'contained'}
          color={isRecording ? 'error' : 'primary'}
          size="large"
          startIcon={
            status === 'connecting' ? (
              <CircularProgress size={18} color="inherit" />
            ) : isRecording ? (
              <MicOffIcon />
            ) : (
              <MicIcon />
            )
          }
          onClick={handleToggleRecording}
          disabled={status === 'connecting'}
          sx={{ minWidth: 140, borderRadius: '14px' }}
        >
          {isRecording ? '중지' : '시작'}
        </Button>

        {/* Speaking indicator */}
        {isRecording && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <GraphicEqIcon
              fontSize="small"
              sx={{
                color: isSpeaking ? 'success.main' : 'text.disabled',
                transition: 'color 0.15s'
              }}
            />
            <Typography
              variant="caption"
              sx={{
                color: isSpeaking ? 'success.main' : 'text.disabled',
                fontWeight: 600,
                transition: 'color 0.15s'
              }}
            >
              {isSpeaking ? '발화 중' : '무음'}
            </Typography>
          </Box>
        )}

        {/* Status chip */}
        <Chip
          label={STATUS_LABEL[status] ?? status}
          size="small"
          sx={{
            bgcolor: 'transparent',
            border: '1px solid',
            borderColor: STATUS_COLOR[status],
            color: STATUS_COLOR[status],
            fontWeight: 600,
            fontSize: '0.72rem'
          }}
        />

        <Box sx={{ flex: 1 }} />

        {/* Translation toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color={hasDeepL ? 'text.primary' : 'text.disabled'}>
            번역
          </Typography>
          <Tooltip title={hasDeepL ? '' : 'DeepL API 키를 설정에서 입력해 주세요'} arrow>
            <span>
              <Switch
                checked={translateMode}
                onChange={(e) => setTranslateMode(e.target.checked)}
                disabled={!hasDeepL}
                size="small"
                color="primary"
              />
            </span>
          </Tooltip>
          {translateMode && (
            <Chip
              label={settings.outputLanguage}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontSize: '0.7rem', height: 22 }}
            />
          )}
        </Box>

        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

        {/* Clear */}
        <Tooltip title="전체 삭제">
          <span>
            <IconButton size="small" onClick={clearSegments} disabled={!canExport}>
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>

        {/* Export: TXT / SRT / CSV */}
        <ButtonGroup size="small" disabled={!canExport} variant="outlined">
          <Button onClick={() => handleExport('txt')} sx={{ fontSize: '0.75rem', px: 1.2 }}>
            TXT
          </Button>
          <Button onClick={() => handleExport('srt')} sx={{ fontSize: '0.75rem', px: 1.2 }}>
            SRT
          </Button>
          <Button onClick={() => handleExport('csv')} sx={{ fontSize: '0.75rem', px: 1.2 }}>
            CSV
          </Button>
        </ButtonGroup>

        {/* Save as project */}
        <Tooltip title="프로젝트로 저장">
          <span>
            <IconButton size="small" onClick={openSaveDialog} disabled={!canExport} color="primary">
              <FolderSpecialIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Paper>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      {error && (
        <Paper
          sx={{
            px: 2,
            py: 1.5,
            bgcolor: 'rgba(239,68,68,0.08)',
            border: '1px solid',
            borderColor: 'error.main',
            flexShrink: 0
          }}
        >
          <Typography variant="body2" color="error.main">
            {error}
          </Typography>
        </Paper>
      )}

      {/* ── Segment list ────────────────────────────────────────────────────── */}
      <Paper
        sx={{
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {segments.length === 0 ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1.5,
              color: 'text.disabled'
            }}
          >
            <MicIcon sx={{ fontSize: 48, opacity: 0.3 }} />
            <Typography variant="body2" sx={{ opacity: 0.6 }}>
              {isRecording
                ? '발화가 감지되면 자막이 여기에 표시됩니다'
                : '시작 버튼을 눌러 실시간 전사를 시작하세요'}
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              overflow: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1.5
            }}
          >
            {segments.map((seg) => (
              <Box
                key={seg.id}
                sx={{
                  display: 'flex',
                  gap: 1.5,
                  alignItems: 'flex-start',
                  animation: 'fadeSlideIn 0.2s ease',
                  '@keyframes fadeSlideIn': {
                    from: { opacity: 0, transform: 'translateY(6px)' },
                    to: { opacity: 1, transform: 'translateY(0)' }
                  }
                }}
              >
                {/* Timestamp */}
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.disabled',
                    fontFamily: 'monospace',
                    fontSize: '0.72rem',
                    flexShrink: 0,
                    mt: 0.15
                  }}
                >
                  {seg.timestamp}
                </Typography>

                {/* Text block */}
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                    {seg.text}
                  </Typography>

                  {/* Translation */}
                  {seg.isTranslating ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                      <CircularProgress size={11} />
                      <Typography variant="caption" color="text.disabled">
                        번역 중...
                      </Typography>
                    </Box>
                  ) : seg.translatedText ? (
                    <Typography
                      variant="caption"
                      sx={{
                        display: 'block',
                        mt: 0.4,
                        color: 'primary.main',
                        opacity: 0.85,
                        lineHeight: 1.55
                      }}
                    >
                      {seg.translatedText}
                    </Typography>
                  ) : null}
                </Box>
              </Box>
            ))}

            {/* Speaking indicator at bottom */}
            {isSpeaking && (
              <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                <Typography
                  variant="caption"
                  sx={{ color: 'text.disabled', fontFamily: 'monospace', fontSize: '0.72rem' }}
                >
                  {nowTimestamp()}
                </Typography>
                <Typography
                  variant="body2"
                  sx={{ color: 'text.disabled', fontStyle: 'italic' }}
                >
                  ▌
                </Typography>
              </Box>
            )}

            <div ref={bottomRef} />
          </Box>
        )}
      </Paper>

      {/* ── Save as project dialog ───────────────────────────────────────────── */}
      <Dialog
        open={saveDialogOpen}
        onClose={() => setSaveDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '1rem' }}>프로젝트로 저장</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="프로젝트 이름"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveProject() }}
          />
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            세그먼트 {segments.length}개가 홈 화면의 프로젝트 목록에 저장됩니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setSaveDialogOpen(false)} color="inherit" size="small">
            취소
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveProject}
            disabled={!projectName.trim() || isSaving}
            size="small"
            sx={{ borderRadius: '10px' }}
          >
            {isSaving ? '저장 중...' : '저장'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}

function nowTimestamp(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}
