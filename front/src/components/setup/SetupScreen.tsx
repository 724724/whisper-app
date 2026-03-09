import { useEffect, useRef } from 'react'
import { Box, Typography, CircularProgress, LinearProgress, Paper, Alert } from '@mui/material'
import { useBackendStore } from '../../store/backendStore'

const PHASE_LABELS: Record<string, string> = {
  checking: 'Python 환경 확인 중',
  installing: '패키지 설치 중',
  starting: '서버 시작 중',
  ready: '준비 완료',
  error: '오류 발생'
}

export function SetupScreen() {
  const { status, logs } = useBackendStore()
  const isError = status.phase === 'error'
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        p: 3
      }}
    >
      <Box sx={{ textAlign: 'center', mb: 1 }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          Whisper App
        </Typography>
        <Typography variant="body2" color="text.secondary">
          AI 기반 음성 텍스트 변환
        </Typography>
      </Box>

      <Box sx={{ width: 400, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!isError && (
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CircularProgress size={40} />
          </Box>
        )}

        {isError ? (
          <Box>
            <Alert severity="error" sx={{ mb: 1 }}>
              시작 실패
            </Alert>
            <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 200, overflowY: 'auto' }}>
              <Typography
                variant="caption"
                component="pre"
                sx={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  fontFamily: 'monospace',
                  display: 'block'
                }}
              >
                {status.message}
              </Typography>
            </Paper>
          </Box>
        ) : (
          <Box sx={{ textAlign: 'center' }}>
            <Typography variant="body1" fontWeight="medium">
              {PHASE_LABELS[status.phase]}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {status.message}
            </Typography>
            {status.progress !== undefined && (
              <LinearProgress
                variant="determinate"
                value={status.progress}
                sx={{ mt: 1.5, borderRadius: 1 }}
              />
            )}
          </Box>
        )}

        {logs.length > 0 && (
          <Paper ref={logRef} variant="outlined" sx={{ maxHeight: 144, overflowY: 'auto', p: 1.5 }}>
            {logs.map((line, i) => (
              <Typography
                key={i}
                variant="caption"
                component="div"
                sx={{
                  fontFamily: 'monospace',
                  py: 0.25,
                  color: line.includes('[error]') ? 'error.main' : 'text.secondary'
                }}
              >
                {line}
              </Typography>
            ))}
          </Paper>
        )}

        {isError && (
          <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
            Python 3.8+ 및 ffmpeg가 설치되어 있는지 확인하세요.
            <br />
            앱을 재시작하면 다시 시도합니다.
          </Typography>
        )}
      </Box>
    </Box>
  )
}
