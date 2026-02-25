import { useEffect, useState } from 'react'
import type { RefObject } from 'react'
import {
  Box,
  IconButton,
  Slider,
  Paper,
  ToggleButtonGroup,
  ToggleButton,
  Typography
} from '@mui/material'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import PauseIcon from '@mui/icons-material/Pause'
import VolumeUpIcon from '@mui/icons-material/VolumeUp'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import type { MediaType } from '../../../../shared/types'

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]

interface MediaPlayerProps {
  mediaUrl: string
  mediaType: MediaType
  mediaRef: RefObject<HTMLVideoElement | HTMLAudioElement | null>
  currentTimeMs: number
  duration: number
  isPlaying: boolean
  playbackRate: number
  onTogglePlay: () => void
  onSeek: (ms: number) => void
  onSpeedChange: (rate: number) => void
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
  playbackRate,
  onTogglePlay,
  onSeek,
  onSpeedChange,
  onTimeUpdate,
  onPlay,
  onPause,
  onDurationChange
}: MediaPlayerProps) {
  const [volume, setVolume] = useState(1)

  useEffect(() => {
    if (mediaRef.current) mediaRef.current.volume = volume
  }, [mediaUrl, mediaRef, volume])

  const seekMax = isFinite(duration) && duration > 0 ? duration : 0

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {mediaType === 'video' ? (
        <Box
          component="video"
          ref={mediaRef as RefObject<HTMLVideoElement>}
          src={mediaUrl}
          onClick={onTogglePlay}
          onTimeUpdate={onTimeUpdate}
          onPlay={onPlay}
          onPause={onPause}
          onDurationChange={onDurationChange}
          sx={{
            width: '100%',
            maxHeight: 208,
            bgcolor: 'black',
            display: 'block',
            objectFit: 'contain',
            cursor: 'pointer'
          }}
        />
      ) : (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: 112,
            bgcolor: 'background.default'
          }}
        >
          <audio
            ref={mediaRef as RefObject<HTMLAudioElement>}
            src={mediaUrl}
            onTimeUpdate={onTimeUpdate}
            onPlay={onPlay}
            onPause={onPause}
            onDurationChange={onDurationChange}
          />
          <MusicNoteIcon sx={{ fontSize: 48, color: 'text.disabled' }} />
        </Box>
      )}

      <Box sx={{ p: 1.5, display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* Seek bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 36, textAlign: 'right', fontFamily: 'monospace' }}
          >
            {formatTime(currentTimeMs)}
          </Typography>
          <Slider
            size="small"
            min={0}
            max={seekMax}
            value={isFinite(currentTimeMs) ? currentTimeMs : 0}
            onChange={(_, v) => onSeek(v as number)}
            disabled={seekMax === 0}
            sx={{ flex: 1 }}
          />
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ minWidth: 36, fontFamily: 'monospace' }}
          >
            {formatTime(duration)}
          </Typography>
        </Box>

        {/* Play + Volume */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <IconButton
            onClick={onTogglePlay}
            size="small"
            sx={{
              bgcolor: 'primary.main',
              color: 'white',
              '&:hover': { bgcolor: 'primary.dark' },
              width: 32,
              height: 32
            }}
          >
            {isPlaying ? (
              <PauseIcon sx={{ fontSize: 18 }} />
            ) : (
              <PlayArrowIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <VolumeUpIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(_, v) => {
                const val = v as number
                setVolume(val)
                if (mediaRef.current) mediaRef.current.volume = val
              }}
              sx={{ width: 72 }}
            />
          </Box>
        </Box>

        {/* Speed selector */}
        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <ToggleButtonGroup
            value={playbackRate}
            exclusive
            size="small"
            onChange={(_, v) => {
              if (v !== null) onSpeedChange(v)
            }}
          >
            {SPEEDS.map((s) => (
              <ToggleButton
                key={s}
                value={s}
                sx={{ px: 0.75, py: 0.25, fontSize: '0.65rem', minWidth: 0, lineHeight: 1.4 }}
              >
                {s}x
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>
      </Box>
    </Paper>
  )
}
