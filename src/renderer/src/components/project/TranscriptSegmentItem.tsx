import { Box, Typography, Button } from '@mui/material'
import type { TranscriptSegment } from '../../../../shared/types'

interface TranscriptSegmentItemProps {
  segment: TranscriptSegment
  isActive: boolean
  onSeek: (ms: number) => void
  onTranslate?: (segmentId: string) => void
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
}: TranscriptSegmentItemProps) {
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
        '&:hover .translate-btn': { opacity: 1 },
        display: 'flex',
        gap: 1.5,
        alignItems: 'flex-start',
      }}
    >
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

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ lineHeight: 1.6, color: isActive ? 'text.primary' : 'text.primary' }}
        >
          {segment.text}
        </Typography>
        {segment.translatedText && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.6 }}>
            {segment.translatedText}
          </Typography>
        )}
      </Box>

      {onTranslate && !segment.translatedText && (
        <Button
          className="translate-btn"
          size="small"
          onClick={(e) => {
            e.stopPropagation()
            onTranslate(segment.id)
          }}
          title="이 문장만 번역"
          sx={{ opacity: 0, transition: 'opacity 0.15s', fontSize: '0.7rem', minWidth: 0, flexShrink: 0, px: 0.5, py: 0 }}
        >
          번역
        </Button>
      )}
    </Box>
  )
}
