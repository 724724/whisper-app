import { useEffect, useRef } from 'react'
import { Box, Typography, CircularProgress } from '@mui/material'
import { TranscriptSegmentItem } from './TranscriptSegmentItem'
import type { Transcript } from '../../../../shared/types'

interface TranscriptPanelProps {
  transcript: Transcript | null
  activeSegmentId: string | null
  isTranscribing: boolean
  receivedSegments: number
  onSeek: (ms: number) => void
  onTranslateSegment: (segmentId: string) => void
}

export function TranscriptPanel({
  transcript,
  activeSegmentId,
  isTranscribing,
  receivedSegments,
  onSeek,
  onTranslateSegment,
}: TranscriptPanelProps) {
  const activeRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSegmentId])

  if (!transcript && !isTranscribing) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography variant="body2" color="text.secondary">
          전사를 시작하려면 아래 버튼을 눌러주세요
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      {transcript?.segments.map((seg) => (
        <div key={seg.id} ref={seg.id === activeSegmentId ? activeRef : null}>
          <TranscriptSegmentItem
            segment={seg}
            isActive={seg.id === activeSegmentId}
            onSeek={onSeek}
            onTranslate={onTranslateSegment}
          />
        </div>
      ))}

      {isTranscribing && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1.5, py: 1.5 }}>
          <CircularProgress size={14} />
          <Typography variant="body2" color="text.secondary">
            분석 중...{receivedSegments > 0 && ` (${receivedSegments}개 처리됨)`}
          </Typography>
        </Box>
      )}
    </Box>
  )
}
