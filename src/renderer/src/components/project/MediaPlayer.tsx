import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import type { MediaType } from '../../../../shared/types'

interface MediaPlayerProps {
  mediaUrl: string
  mediaType: MediaType
  mediaRef: RefObject<HTMLVideoElement | HTMLAudioElement | null>
  currentTimeMs: number
  duration: number
  isPlaying: boolean
  onTogglePlay: () => void
  onSeek: (ms: number) => void
  onTimeUpdate: (e: React.SyntheticEvent<HTMLMediaElement>) => void
  onPlay: () => void
  onPause: () => void
  onDurationChange: (e: React.SyntheticEvent<HTMLMediaElement>) => void
}

function formatTime(ms: number): string {
  if (!isFinite(ms) || ms < 0) return '--:--'
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

export function MediaPlayer({
  mediaUrl,
  mediaType,
  mediaRef,
  currentTimeMs,
  duration,
  isPlaying,
  onTogglePlay,
  onSeek,
  onTimeUpdate,
  onPlay,
  onPause,
  onDurationChange,
}: MediaPlayerProps) {
  const [volume, setVolume] = useState(1)

  const handleSeekBar = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSeek(Number(e.target.value))
  }

  const handleVolume = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (mediaRef.current) mediaRef.current.volume = v
  }

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.volume = volume
  }, [mediaUrl, mediaRef, volume])

  return (
    <div className="bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
      {mediaType === 'video' ? (
        <video
          ref={mediaRef as RefObject<HTMLVideoElement>}
          src={mediaUrl}
          className="w-full max-h-52 bg-black object-contain"
          onClick={onTogglePlay}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onDurationChange={onDurationChange}
        />
      ) : (
        <div className="flex items-center justify-center h-28 bg-zinc-950 relative">
          <audio
            ref={mediaRef as RefObject<HTMLAudioElement>}
            src={mediaUrl}
            onTimeUpdate={onTimeUpdate}
            onPlay={onPlay}
            onPause={onPause}
            onDurationChange={onDurationChange}
          />
          <div className="text-5xl select-none">{isPlaying ? '🔊' : '🎵'}</div>
        </div>
      )}

      {/* Controls */}
      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="w-10 text-right shrink-0">{formatTime(currentTimeMs)}</span>
          <input
            type="range"
            min={0}
            max={isFinite(duration) && duration > 0 ? duration : 0}
            value={isFinite(currentTimeMs) ? currentTimeMs : 0}
            onChange={handleSeekBar}
            disabled={!isFinite(duration) || duration === 0}
            className="flex-1 h-1.5 accent-blue-500 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <span className="w-10 shrink-0">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={onTogglePlay}
            className="bg-blue-600 hover:bg-blue-500 text-white rounded-full w-10 h-10 flex items-center justify-center text-lg transition-colors"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>

          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-sm">🔈</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={handleVolume}
              className="w-20 h-1.5 accent-blue-500 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
