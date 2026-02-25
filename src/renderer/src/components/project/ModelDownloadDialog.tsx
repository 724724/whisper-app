import { Dialog, DialogContent, Box, Typography, LinearProgress } from '@mui/material'
import DownloadingIcon from '@mui/icons-material/Downloading'
import type { ModelDownloadInfo } from '../../hooks/useTranscribe'

interface ModelDownloadDialogProps {
  info: ModelDownloadInfo | null
}

export function ModelDownloadDialog({ info }: ModelDownloadDialogProps) {
  const open = info !== null

  return (
    <Dialog
      open={open}
      maxWidth="xs"
      fullWidth
      disableEscapeKeyDown
      slotProps={{
        backdrop: { sx: { backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' } }
      }}
    >
      <DialogContent sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
          <DownloadingIcon color="primary" sx={{ fontSize: 28 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              모델 다운로드 중
            </Typography>
            <Typography variant="caption" color="text.secondary">
              처음 사용하는 모델은 자동으로 다운로드됩니다
            </Typography>
          </Box>
        </Box>

        {/* Model name + size */}
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            mb: 1
          }}
        >
          <Typography variant="body2" fontWeight={600}>
            {info?.model ?? ''}
          </Typography>
          {info && info.sizeMb > 0 && (
            <Typography variant="caption" color="text.secondary">
              약{' '}
              {info.sizeMb >= 1000 ? `${(info.sizeMb / 1000).toFixed(1)} GB` : `${info.sizeMb} MB`}
            </Typography>
          )}
        </Box>

        {/* Progress bar */}
        <LinearProgress
          variant={info && info.percent > 0 ? 'determinate' : 'indeterminate'}
          value={info?.percent ?? 0}
          sx={{ borderRadius: 1, height: 6 }}
        />

        {/* Percentage */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.75 }}>
          <Typography variant="caption" color="text.secondary">
            인터넷 연결을 확인해 주세요
          </Typography>
          {info && info.percent > 0 && (
            <Typography variant="caption" fontWeight={700} color="primary.main">
              {info.percent}%
            </Typography>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  )
}
