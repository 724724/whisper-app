import { Box, Button, Alert, LinearProgress, Typography } from '@mui/material'
import { useSettingsStore } from '../../store/settingsStore'
import type { ProjectStatus } from '../../../../shared/types'

interface TranscribeButtonProps {
  projectStatus: ProjectStatus
  isTranscribing: boolean
  receivedSegments: number
  progressPct: number
  transcribeError: string | null
  onStart: () => void
  onCancel: () => void
}

export function TranscribeButton({
  projectStatus,
  isTranscribing,
  receivedSegments,
  progressPct,
  transcribeError,
  onStart,
  onCancel,
}: TranscribeButtonProps) {
  const model = useSettingsStore((s) => s.settings.whisperModel)

  if (isTranscribing) {
    const isLoadingModel = receivedSegments === 0
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {isLoadingModel
            ? `모델 로딩 중... (${model} — 첫 실행 시 다운로드 필요)`
            : `전사 중... ${progressPct}% (${receivedSegments}개 세그먼트)`}
        </Typography>
        <LinearProgress
          variant={isLoadingModel ? 'indeterminate' : 'determinate'}
          value={isLoadingModel ? undefined : progressPct}
        />
        {isLoadingModel && (
          <Typography variant="caption" color="text.secondary" align="center">
            모델을 처음 사용할 때 HuggingFace에서 자동 다운로드됩니다.
            <br />
            인터넷 연결을 확인하고 잠시 기다려주세요.
          </Typography>
        )}
        <Button
          variant="outlined"
          color="error"
          size="small"
          fullWidth
          onClick={onCancel}
        >
          전사 중단
        </Button>
      </Box>
    )
  }

  if (projectStatus === 'done') {
    return (
      <Button variant="outlined" size="small" fullWidth onClick={onStart}>
        재전사 ({model})
      </Button>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {transcribeError && (
        <Alert severity="error" sx={{ fontSize: '0.75rem' }}>
          <Box component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.7rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all', m: 0 }}>
            {transcribeError}
          </Box>
        </Alert>
      )}
      <Button variant="contained" fullWidth onClick={onStart}>
        {projectStatus === 'error' ? `재시도 (${model})` : `전사 시작 (${model})`}
      </Button>
    </Box>
  )
}
