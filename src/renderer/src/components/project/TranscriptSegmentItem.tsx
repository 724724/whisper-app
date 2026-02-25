import { useState } from 'react'
import { Box, Typography, IconButton, Menu, MenuItem, CircularProgress, ListItemIcon } from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import TranslateIcon from '@mui/icons-material/Translate'
import ReplayIcon from '@mui/icons-material/Replay'
import DeleteIcon from '@mui/icons-material/Delete'
import type { TranscriptSegment } from '../../../../shared/types'

interface TranscriptSegmentItemProps {
  segment: TranscriptSegment
  isActive: boolean
  onSeek: (ms: number) => void
  onTranslate?: (segmentId: string) => void
  onDelete?: (segmentId: string) => void
  onRetranscribe?: (segment: TranscriptSegment) => void
  isRetranscribing?: boolean
}

function formatTimestamp(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function TranscriptSegmentItem({
  segment,
  isActive,
  onSeek,
  onTranslate,
  onDelete,
  onRetranscribe,
  isRetranscribing,
}: TranscriptSegmentItemProps) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)

  const handleMenuOpen = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation()
    setAnchorEl(e.currentTarget)
  }

  const handleMenuClose = () => setAnchorEl(null)

  return (
    <Box
      onClick={() => onSeek(segment.startMs)}
      sx={{
        px: 1.5,
        py: 1,
        borderRadius: 1,
        cursor: 'pointer',
        border: '1px solid',
        borderColor: isActive ? 'primary.dark' : 'transparent',
        bgcolor: isActive ? 'primary.dark' : 'transparent',
        '&:hover': { bgcolor: isActive ? 'primary.dark' : 'action.hover' },
        '&:hover .seg-menu-btn': { opacity: 1 },
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
      }}
    >
      {/* 타임스탬프 */}
      <Typography
        variant="caption"
        sx={{
          fontFamily: 'monospace',
          flexShrink: 0,
          mt: 0.25,
          color: isActive ? 'primary.light' : 'text.secondary',
        }}
      >
        {formatTimestamp(segment.startMs)}
      </Typography>

      {/* 텍스트 */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ lineHeight: 1.6, opacity: isRetranscribing ? 0.4 : 1, transition: 'opacity 0.2s' }}
        >
          {segment.text}
        </Typography>
        {segment.translatedText && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
            {segment.translatedText}
          </Typography>
        )}
      </Box>

      {/* ⋮ 버튼 or 로딩 */}
      <Box sx={{ flexShrink: 0, mt: -0.5 }}>
        {isRetranscribing ? (
          <CircularProgress size={16} sx={{ mt: 0.5 }} />
        ) : (
          <IconButton
            className="seg-menu-btn"
            size="small"
            onClick={handleMenuOpen}
            sx={{ opacity: 0, transition: 'opacity 0.15s', p: 0.25 }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* 컨텍스트 메뉴 */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        onClick={(e) => e.stopPropagation()}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 130 } } }}
      >
        {onTranslate && (
          <MenuItem dense onClick={() => { onTranslate(segment.id); handleMenuClose() }}>
            <ListItemIcon><TranslateIcon fontSize="small" /></ListItemIcon>
            번역
          </MenuItem>
        )}
        {onRetranscribe && (
          <MenuItem dense onClick={() => { onRetranscribe(segment); handleMenuClose() }}>
            <ListItemIcon><ReplayIcon fontSize="small" /></ListItemIcon>
            재전사
          </MenuItem>
        )}
        {onDelete && (
          <MenuItem
            dense
            onClick={() => { onDelete(segment.id); handleMenuClose() }}
            sx={{ color: 'error.main', '& .MuiListItemIcon-root': { color: 'error.main' } }}
          >
            <ListItemIcon><DeleteIcon fontSize="small" /></ListItemIcon>
            삭제
          </MenuItem>
        )}
      </Menu>
    </Box>
  )
}
