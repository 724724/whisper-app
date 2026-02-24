import { useRef, useState, useCallback } from 'react'
import { useTranscriptStore } from '../store/transcriptStore'

export function useMediaPlayer() {
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null)
  const [currentTimeMs, setCurrentTimeMs] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)

  const setActiveSegmentId = useTranscriptStore((s) => s.setActiveSegmentId)
  const transcript = useTranscriptStore((s) => s.transcript)

  const seekTo = useCallback((ms: number) => {
    if (mediaRef.current) {
      mediaRef.current.currentTime = ms / 1000
      mediaRef.current.play().catch(() => {})
    }
  }, [])

  const togglePlay = useCallback(() => {
    if (!mediaRef.current) return
    if (mediaRef.current.paused) {
      mediaRef.current.play().catch(() => {})
    } else {
      mediaRef.current.pause()
    }
  }, [])

  // React synthetic event handlers — attached directly in JSX so they work
  // immediately when the element mounts (no useEffect/ref timing issue)
  const handleTimeUpdate = useCallback(
    (e: React.SyntheticEvent<HTMLMediaElement>) => {
      const ms = e.currentTarget.currentTime * 1000
      setCurrentTimeMs(ms)
      if (transcript) {
        const active = transcript.segments.find((s) => ms >= s.startMs && ms < s.endMs)
        setActiveSegmentId(active?.id ?? null)
      }
    },
    [transcript, setActiveSegmentId]
  )

  const handlePlay = useCallback(() => setIsPlaying(true), [])
  const handlePause = useCallback(() => setIsPlaying(false), [])

  const handleDurationChange = useCallback((e: React.SyntheticEvent<HTMLMediaElement>) => {
    setDuration(e.currentTarget.duration * 1000)
  }, [])

  return {
    mediaRef,
    currentTimeMs,
    isPlaying,
    duration,
    seekTo,
    togglePlay,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleDurationChange,
  }
}
