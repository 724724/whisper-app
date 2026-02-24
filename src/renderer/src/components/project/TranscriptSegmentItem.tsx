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
    <div
      className={`group px-3 py-2.5 rounded-lg transition-colors cursor-pointer ${
        isActive ? 'bg-blue-950 border border-blue-800' : 'hover:bg-zinc-800 border border-transparent'
      }`}
      onClick={() => onSeek(segment.startMs)}
    >
      <div className="flex items-start gap-3">
        {/* Timestamp */}
        <span
          className={`text-xs font-mono shrink-0 mt-0.5 ${
            isActive ? 'text-blue-400' : 'text-zinc-500'
          }`}
        >
          {formatTimestamp(segment.startMs)}
        </span>

        {/* Text content */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-relaxed ${isActive ? 'text-white' : 'text-zinc-300'}`}>
            {segment.text}
          </p>
          {segment.translatedText && (
            <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{segment.translatedText}</p>
          )}
        </div>

        {/* Per-segment translate button */}
        {onTranslate && !segment.translatedText && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onTranslate(segment.id)
            }}
            className="opacity-0 group-hover:opacity-100 text-xs text-zinc-500 hover:text-blue-400 transition-all shrink-0"
            title="이 문장만 번역"
          >
            번역
          </button>
        )}
      </div>
    </div>
  )
}
