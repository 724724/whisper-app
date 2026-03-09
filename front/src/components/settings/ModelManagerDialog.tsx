import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Typography
} from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import DownloadIcon from '@mui/icons-material/Download'
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline'
import { BACKEND_URL, backendFetch } from '../../hooks/useBackend'

interface ModelStatus {
  name: string
  size_mb: number
  downloaded: boolean
}

interface DownloadProgress {
  percent: number
  sizeMb: number
}

interface ModelManagerDialogProps {
  open: boolean
  onClose: () => void
}

const MODEL_LABELS: Record<string, string> = {
  tiny: 'Tiny',
  base: 'Base',
  small: 'Small',
  medium: 'Medium',
  'large-v2': 'Large v2',
  'large-v3': 'Large v3'
}

function fmtSize(mb: number): string {
  return mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`
}

export function ModelManagerDialog({ open, onClose }: ModelManagerDialogProps) {
  const [models, setModels] = useState<ModelStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [downloadingModel, setDownloadingModel] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [deletingModel, setDeletingModel] = useState<string | null>(null)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [confirmDeleteModel, setConfirmDeleteModel] = useState<string | null>(null)
  const esRef = useRef<EventSource | null>(null)

  const loadStatus = useCallback(async () => {
    setLoading(true)
    try {
      const res = await backendFetch('/models/status')
      if (res.ok) setModels((await res.json()) as ModelStatus[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) {
      setDownloadError(null)
      loadStatus()
    } else {
      // Close any in-flight download stream when dialog closes
      esRef.current?.close()
      esRef.current = null
    }
  }, [open, loadStatus])

  // Cleanup on unmount
  useEffect(() => () => { esRef.current?.close() }, [])

  const handleDownload = (modelName: string) => {
    setDownloadError(null)
    setDownloadingModel(modelName)
    setDownloadProgress({ percent: 0, sizeMb: 0 })

    const es = new EventSource(`${BACKEND_URL}/models/${modelName}/download`)
    esRef.current = es

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data as string) as Record<string, unknown>
      if (msg.type === 'model_downloading') {
        setDownloadProgress({
          percent: msg.percent as number,
          sizeMb: msg.size_mb as number
        })
      } else if (msg.type === 'done') {
        es.close()
        esRef.current = null
        setDownloadingModel(null)
        setDownloadProgress(null)
        loadStatus()
      } else if (msg.type === 'error') {
        es.close()
        esRef.current = null
        setDownloadingModel(null)
        setDownloadProgress(null)
        setDownloadError(msg.message as string)
      }
    }

    es.onerror = () => {
      es.close()
      esRef.current = null
      setDownloadingModel(null)
      setDownloadProgress(null)
      setDownloadError('다운로드 중 연결 오류가 발생했습니다.')
    }
  }

  const handleDeleteConfirmed = async () => {
    const modelName = confirmDeleteModel
    if (!modelName) return
    setConfirmDeleteModel(null)
    setDeletingModel(modelName)
    try {
      await backendFetch(`/models/${modelName}`, { method: 'DELETE' })
      await loadStatus()
    } finally {
      setDeletingModel(null)
    }
  }

  const busy = downloadingModel !== null || deletingModel !== null

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: 700,
          fontSize: '1rem',
          pb: 1
        }}
      >
        모델 관리
        <IconButton size="small" onClick={onClose} sx={{ color: 'text.secondary' }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pb: 3 }}>
        {downloadError && (
          <Box
            sx={{
              mb: 2,
              px: 1.5,
              py: 1,
              borderRadius: '10px',
              bgcolor: 'rgba(239,68,68,0.08)',
              border: '1px solid',
              borderColor: 'error.main'
            }}
          >
            <Typography variant="caption" color="error.main">
              {downloadError}
            </Typography>
          </Box>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {models.map((m) => {
              const isDownloading = downloadingModel === m.name
              const isDeleting = deletingModel === m.name

              return (
                <Box
                  key={m.name}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: '12px',
                    p: 1.5,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 1
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography variant="body2" fontWeight={600}>
                        {MODEL_LABELS[m.name] ?? m.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {fmtSize(m.size_mb)}
                      </Typography>
                    </Box>

                    {m.downloaded ? (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Chip
                          size="small"
                          icon={<CheckCircleOutlineIcon sx={{ fontSize: '13px !important' }} />}
                          label="다운로드됨"
                          color="success"
                          variant="outlined"
                          sx={{ fontSize: '0.72rem', height: 24 }}
                        />
                        <IconButton
                          size="small"
                          onClick={() => setConfirmDeleteModel(m.name)}
                          disabled={busy}
                          color="error"
                          sx={{ opacity: 0.65, '&:hover': { opacity: 1 } }}
                        >
                          {isDeleting ? (
                            <CircularProgress size={16} color="error" />
                          ) : (
                            <DeleteOutlineIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    ) : (
                      <Button
                        size="small"
                        variant="outlined"
                        startIcon={
                          isDownloading ? (
                            <CircularProgress size={13} color="inherit" />
                          ) : (
                            <DownloadIcon fontSize="small" />
                          )
                        }
                        onClick={() => handleDownload(m.name)}
                        disabled={busy}
                        sx={{ fontSize: '0.78rem', borderRadius: '8px', minWidth: 110 }}
                      >
                        {isDownloading ? '다운로드 중...' : '다운로드'}
                      </Button>
                    )}
                  </Box>

                  {isDownloading && downloadProgress && (
                    <Box>
                      <LinearProgress
                        variant={downloadProgress.percent > 0 ? 'determinate' : 'indeterminate'}
                        value={downloadProgress.percent}
                        sx={{ borderRadius: 1, height: 4 }}
                      />
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ mt: 0.4, display: 'block' }}
                      >
                        {downloadProgress.percent > 0
                          ? `${downloadProgress.percent}%${downloadProgress.sizeMb > 0 ? ` / ${fmtSize(downloadProgress.sizeMb)}` : ''}`
                          : '다운로드 준비 중...'}
                      </Typography>
                    </Box>
                  )}
                </Box>
              )
            })}
          </Box>
        )}
      </DialogContent>

      {/* Delete confirmation dialog */}
      <Dialog
        open={confirmDeleteModel !== null}
        onClose={() => setConfirmDeleteModel(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 700, fontSize: '0.95rem', pb: 1 }}>
          모델 삭제
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            <strong>{MODEL_LABELS[confirmDeleteModel ?? ''] ?? confirmDeleteModel}</strong> 모델을 삭제하시겠습니까?
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            삭제 후 재사용하려면 다시 다운로드해야 합니다.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button
            onClick={() => setConfirmDeleteModel(null)}
            color="inherit"
            size="small"
          >
            취소
          </Button>
          <Button
            onClick={handleDeleteConfirmed}
            color="error"
            variant="contained"
            size="small"
            sx={{ borderRadius: '10px' }}
          >
            삭제
          </Button>
        </DialogActions>
      </Dialog>
    </Dialog>
  )
}
