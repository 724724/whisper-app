import { useEffect, useRef, useState, useCallback, type ReactNode } from 'react'
import { Box, Typography, CircularProgress, IconButton, Button } from '@mui/material'
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown'
import DeleteIcon from '@mui/icons-material/Delete'
import { TranscriptSegmentItem } from './TranscriptSegmentItem'
import type { Transcript, TranscriptSegment } from '../../../../shared/types'

interface TranscriptPanelProps {
  transcript: Transcript | null
  activeSegmentId: string | null
  isTranscribing: boolean
  receivedSegments: number
  onSeekOnly: (ms: number) => void
  onTranslateSegment: (segmentId: string) => void
  onDeleteSegment: (segmentId: string) => void
  onDeleteSegments: (ids: string[]) => void
  onRetranscribeSegment: (segment: TranscriptSegment) => void
  retranscribingSegmentId: string | null
}

export function TranscriptPanel({
  transcript,
  activeSegmentId,
  isTranscribing,
  receivedSegments,
  onSeekOnly,
  onTranslateSegment,
  onDeleteSegment,
  onDeleteSegments,
  onRetranscribeSegment,
  retranscribingSegmentId
}: TranscriptPanelProps): ReactNode {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null)
  const [isFollowing, setIsFollowing] = useState(true)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const activeRef = useRef<HTMLDivElement | null>(null)
  const isUserScrolling = useRef(false)
  const prevSegmentCount = useRef(0)
  const prevActiveId = useRef<string | null>(null)

  // Detect user-initiated scroll and disable follow mode
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onWheel = (): void => {
      isUserScrolling.current = true
    }
    const onTouchStart = (): void => {
      isUserScrolling.current = true
    }
    const onScroll = (): void => {
      if (isUserScrolling.current) {
        setIsFollowing(false)
        isUserScrolling.current = false
      }
    }

    el.addEventListener('wheel', onWheel, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('scroll', onScroll)
    }
  }, [])

  // Follow mode: auto-scroll to bottom when new segments arrive during transcription
  useEffect(() => {
    const segCount = transcript?.segments.length ?? 0
    if (isTranscribing && segCount > prevSegmentCount.current && isFollowing) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevSegmentCount.current = segCount
  }, [transcript?.segments.length, isTranscribing, isFollowing])

  // Center active segment during playback (only when not transcribing)
  useEffect(() => {
    if (!activeSegmentId || activeSegmentId === prevActiveId.current) return
    prevActiveId.current = activeSegmentId
    if (isTranscribing) return

    const el = activeRef.current
    const container = scrollRef.current
    if (!el || !container) return

    const containerHeight = container.clientHeight
    const elTop = el.offsetTop
    const elHeight = el.offsetHeight
    const targetScrollTop = elTop - containerHeight / 2 + elHeight / 2
    container.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
  }, [activeSegmentId, isTranscribing])

  // Reset follow mode + selection when transcription starts.
  // Using the React-recommended "setState during render on prop change" pattern
  // to avoid calling setState inside an effect body.
  const [prevIsTranscribing, setPrevIsTranscribing] = useState(isTranscribing)
  if (prevIsTranscribing !== isTranscribing) {
    setPrevIsTranscribing(isTranscribing)
    if (isTranscribing) {
      setIsFollowing(true)
      setSelectedIds(new Set())
    }
  }

  // Ctrl+C: copy selected segments to clipboard
  useEffect(() => {
    if (selectedIds.size === 0) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        const selected = (transcript?.segments ?? []).filter((s) => selectedIds.has(s.id))
        const text = selected.map((s) => s.text).join('\n')
        navigator.clipboard.writeText(text)
        e.preventDefault()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, transcript?.segments])

  const handleSelect = useCallback(
    (id: string, startMs: number, e: React.MouseEvent) => {
      const segments = transcript?.segments ?? []

      if (e.shiftKey && lastSelectedId) {
        // Range select
        const lastIdx = segments.findIndex((s) => s.id === lastSelectedId)
        const currentIdx = segments.findIndex((s) => s.id === id)
        if (lastIdx !== -1 && currentIdx !== -1) {
          const [from, to] = lastIdx < currentIdx ? [lastIdx, currentIdx] : [currentIdx, lastIdx]
          setSelectedIds(new Set(segments.slice(from, to + 1).map((s) => s.id)))
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle individual
        setSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(id)) next.delete(id)
          else next.add(id)
          return next
        })
        setLastSelectedId(id)
      } else {
        // Single select + seek
        setSelectedIds(new Set([id]))
        setLastSelectedId(id)
        onSeekOnly(startMs)
      }
    },
    [transcript?.segments, lastSelectedId, onSeekOnly]
  )

  const handleBulkDelete = useCallback(() => {
    onDeleteSegments(Array.from(selectedIds))
    setSelectedIds(new Set())
  }, [selectedIds, onDeleteSegments])

  const scrollToBottom = useCallback(() => {
    setIsFollowing(true)
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [])

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
    <Box sx={{ position: 'relative', height: '100%' }}>
      {/* Bulk delete toolbar */}
      {selectedIds.size > 0 && (
        <Box
          sx={{
            position: 'sticky',
            top: 0,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            px: 1.5,
            py: 0.75,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)'
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
            {selectedIds.size}개 선택됨
          </Typography>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon fontSize="small" />}
            onClick={handleBulkDelete}
            sx={{ fontSize: '0.75rem' }}
          >
            삭제
          </Button>
          <Button
            size="small"
            onClick={() => setSelectedIds(new Set())}
            sx={{ fontSize: '0.75rem' }}
          >
            취소
          </Button>
        </Box>
      )}

      {/* Scrollable list */}
      <Box
        ref={scrollRef}
        sx={{
          height: selectedIds.size > 0 ? 'calc(100% - 40px)' : '100%',
          overflowY: 'auto',
          p: 1
        }}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {transcript?.segments.map((seg) => (
            <div key={seg.id} ref={seg.id === activeSegmentId ? activeRef : null}>
              <TranscriptSegmentItem
                segment={seg}
                isActive={seg.id === activeSegmentId}
                isSelected={selectedIds.has(seg.id)}
                onSelect={(e) => handleSelect(seg.id, seg.startMs, e)}
                onTranslate={onTranslateSegment}
                onDelete={onDeleteSegment}
                onRetranscribe={onRetranscribeSegment}
                isRetranscribing={retranscribingSegmentId === seg.id}
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
      </Box>

      {/* Follow arrow button — shown when user has scrolled away */}
      {!isFollowing && (
        <IconButton
          onClick={scrollToBottom}
          size="small"
          sx={{
            position: 'absolute',
            bottom: 12,
            right: 16,
            bgcolor: 'background.paper',
            border: '1px solid',
            borderColor: 'divider',
            boxShadow: 3,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            '&:hover': { bgcolor: 'action.hover' }
          }}
        >
          <KeyboardArrowDownIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  )
}
