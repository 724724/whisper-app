import { useEffect, useRef } from 'react'
import { TranscriptSegmentItem } from './TranscriptSegmentItem'
import { Spinner } from '../ui/Spinner'
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

  // Auto-scroll to active segment
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [activeSegmentId])

  if (!transcript && !isTranscribing) {
    return (
      <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">
        전사를 시작하려면 아래 버튼을 눌러주세요
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto px-1 space-y-1 min-h-0">
      {transcript?.segments.map((seg) => (
        <div
          key={seg.id}
          ref={seg.id === activeSegmentId ? activeRef : null}
        >
          <TranscriptSegmentItem
            segment={seg}
            isActive={seg.id === activeSegmentId}
            onSeek={onSeek}
            onTranslate={onTranslateSegment}
          />
        </div>
      ))}

      {/* Loading indicator for streaming segments */}
      {isTranscribing && (
        <div className="flex items-center gap-3 px-3 py-3 text-zinc-400 text-sm">
          <Spinner size="sm" />
          <span>
            분석 중... {receivedSegments > 0 && `(${receivedSegments}개 처리됨)`}
          </span>
        </div>
      )}
    </div>
  )
}
