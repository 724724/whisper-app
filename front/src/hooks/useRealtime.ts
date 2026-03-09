import { useCallback, useEffect, useRef, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'

const BACKEND_WS_URL = 'ws://127.0.0.1:18765/ws/realtime'

// RMS silence threshold: values below this are treated as silence
const VAD_SILENCE_THRESHOLD = 0.02       // ~-34 dB — raised to avoid ambient-noise false triggers
const VAD_SILENCE_DURATION_MS = 800      // 0.8 s of silence ends an utterance
const VAD_MIN_SPEECH_MS = 200            // ignore utterances shorter than 200 ms
const PARTIAL_INTERVAL_MS = 2000         // flush a partial chunk every 2 s while speaking

export interface RealtimeSegment {
  id: string
  text: string
  translatedText: string | null
  timestamp: string  // HH:MM:SS wall clock
  startMs: number    // ms elapsed since session start
  isTranslating: boolean
}

type RealtimeStatus = 'idle' | 'connecting' | 'listening' | 'transcribing' | 'error'

function nowTimestamp(): string {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

export function useRealtime() {
  const [status, setStatus] = useState<RealtimeStatus>('idle')
  const [segments, setSegments] = useState<RealtimeSegment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [translateMode, setTranslateMode] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)

  const settings = useSettingsStore((s) => s.settings)

  // Refs to hold mutable state without causing re-renders
  const wsRef = useRef<WebSocket | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)         // raw mic stream
  const recordingStreamRef = useRef<MediaStream | null>(null) // processed stream for recording
  const chunksRef = useRef<Blob[]>([])
  const rafRef = useRef<number | null>(null)
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const partialIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const speechStartRef = useRef<number | null>(null)
  const isSpeakingRef = useRef(false)
  const isActiveRef = useRef(false)   // true while session is running
  const translateModeRef = useRef(false)
  const sessionStartMsRef = useRef<number>(0)  // Date.now() when start() was called

  // Keep ref in sync with state
  useEffect(() => {
    translateModeRef.current = translateMode
  }, [translateMode])

  // ── Translation helper ──────────────────────────────────────────────────────
  const translateSegmentText = useCallback(
    async (segId: string, text: string) => {
      if (!settings.deeplApiKey) return
      try {
        const result = await window.api.translateText({
          text,
          targetLang: settings.outputLanguage
        })
        if (result.success && result.text) {
          setSegments((prev) =>
            prev.map((s) =>
              s.id === segId ? { ...s, translatedText: result.text!, isTranslating: false } : s
            )
          )
        } else {
          setSegments((prev) =>
            prev.map((s) =>
              s.id === segId ? { ...s, isTranslating: false } : s
            )
          )
        }
      } catch {
        setSegments((prev) =>
          prev.map((s) => (s.id === segId ? { ...s, isTranslating: false } : s))
        )
      }
    },
    [settings.deeplApiKey, settings.outputLanguage]
  )

  // ── Add a new segment ───────────────────────────────────────────────────────
  const addSegment = useCallback(
    (text: string) => {
      const id = `rt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const shouldTranslate = translateModeRef.current && !!settings.deeplApiKey
      const newSeg: RealtimeSegment = {
        id,
        text,
        translatedText: null,
        timestamp: nowTimestamp(),
        startMs: Date.now() - sessionStartMsRef.current,
        isTranslating: shouldTranslate
      }
      setSegments((prev) => [...prev, newSeg])
      if (shouldTranslate) {
        translateSegmentText(id, text)
      }
    },
    [settings.deeplApiKey, translateSegmentText]
  )

  // ── MediaRecorder: stop current utterance and send audio ───────────────────
  const stopUtterance = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'recording') return

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      chunksRef.current = []

      const ws = wsRef.current
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (blob.size < 100) return  // too small to contain speech

      setStatus('transcribing')
      blob.arrayBuffer().then((buf) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(buf)
        }
      })
    }
    mr.stop()
  }, [])

  // ── Start recording current utterance ──────────────────────────────────────
  const startUtterance = useCallback(() => {
    const stream = recordingStreamRef.current ?? streamRef.current
    if (!stream) return

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm'

    const mr = new MediaRecorder(stream, { mimeType })
    mediaRecorderRef.current = mr
    chunksRef.current = []

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }
    mr.start(100)  // timeslice 100ms so we get chunks while recording
  }, [])

  // ── Flush current recorder: send blob, start fresh recorder ────────────────
  // Called periodically while speaking to stream partial transcriptions
  const flushAndRestartUtterance = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state !== 'recording') return

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType })
      chunksRef.current = []

      const ws = wsRef.current
      if (blob.size >= 100 && ws && ws.readyState === WebSocket.OPEN) {
        setStatus('transcribing')
        blob.arrayBuffer().then((buf) => {
          if (ws.readyState === WebSocket.OPEN) ws.send(buf)
        })
      }

      // Only restart if we're still in a speaking session
      if (isSpeakingRef.current && isActiveRef.current) {
        startUtterance()
      }
    }
    mr.stop()
  }, [startUtterance])

  // ── VAD loop ────────────────────────────────────────────────────────────────
  const vadLoop = useCallback(() => {
    if (!isActiveRef.current) return

    const analyser = analyserRef.current
    if (!analyser) return

    const buf = new Float32Array(analyser.fftSize)
    analyser.getFloatTimeDomainData(buf)

    // RMS amplitude
    let sum = 0
    for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
    const rms = Math.sqrt(sum / buf.length)

    const speaking = rms > VAD_SILENCE_THRESHOLD

    if (speaking) {
      // Clear any pending silence timer
      if (silenceTimerRef.current !== null) {
        clearTimeout(silenceTimerRef.current)
        silenceTimerRef.current = null
      }

      if (!isSpeakingRef.current) {
        // Speech just started
        isSpeakingRef.current = true
        speechStartRef.current = Date.now()
        setIsSpeaking(true)
        startUtterance()

        // Periodically flush partial chunks while speaking
        partialIntervalRef.current = setInterval(() => {
          flushAndRestartUtterance()
        }, PARTIAL_INTERVAL_MS)
      }
    } else {
      // Silence: start/extend silence timer
      if (isSpeakingRef.current && silenceTimerRef.current === null) {
        silenceTimerRef.current = setTimeout(() => {
          // Stop periodic partial flushing
          if (partialIntervalRef.current !== null) {
            clearInterval(partialIntervalRef.current)
            partialIntervalRef.current = null
          }
          silenceTimerRef.current = null
          const elapsed = speechStartRef.current ? Date.now() - speechStartRef.current : 0
          isSpeakingRef.current = false
          setIsSpeaking(false)
          if (elapsed >= VAD_MIN_SPEECH_MS) {
            stopUtterance()
          } else {
            // too short — just reset recorder without sending
            const mr = mediaRecorderRef.current
            if (mr && mr.state === 'recording') {
              mr.onstop = () => { chunksRef.current = [] }
              mr.stop()
            }
          }
          if (isActiveRef.current) setStatus('listening')
        }, VAD_SILENCE_DURATION_MS)
      }
    }

    rafRef.current = requestAnimationFrame(vadLoop)
  }, [startUtterance, stopUtterance, flushAndRestartUtterance])

  // ── Start session ───────────────────────────────────────────────────────────
  const start = useCallback(async () => {
    setError(null)
    setStatus('connecting')
    isActiveRef.current = true
    sessionStartMsRef.current = Date.now()

    // Get microphone
    const audioDeviceId = settings.audioDeviceId
    const audioConstraints: boolean | MediaTrackConstraints = audioDeviceId
      ? { deviceId: { exact: audioDeviceId } }
      : true
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
    } catch (err) {
      setError(`마이크 접근 실패: ${(err as Error).message}`)
      setStatus('error')
      isActiveRef.current = false
      return
    }
    streamRef.current = stream

    // AudioContext + AnalyserNode for VAD
    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    const source = ctx.createMediaStreamSource(stream)

    // Build lecture-enhancement chain when enabled
    if (settings.realtimeEnhance) {
      // Gain boost (2.5x ≈ +8 dB)
      const gain = ctx.createGain()
      gain.gain.value = 2.5

      // High-pass at 100 Hz — remove HVAC / room rumble
      const hp = ctx.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 100
      hp.Q.value = 0.7

      // Peaking at 350 Hz, −6 dB — reduce boxy room boom
      const mid1 = ctx.createBiquadFilter()
      mid1.type = 'peaking'
      mid1.frequency.value = 350
      mid1.gain.value = -6
      mid1.Q.value = 1.0

      // Peaking at 2800 Hz, +5 dB — presence / speech clarity
      const mid2 = ctx.createBiquadFilter()
      mid2.type = 'peaking'
      mid2.frequency.value = 2800
      mid2.gain.value = 5
      mid2.Q.value = 1.2

      // High-shelf at 8000 Hz, +3 dB — consonant clarity
      const shelf = ctx.createBiquadFilter()
      shelf.type = 'highshelf'
      shelf.frequency.value = 8000
      shelf.gain.value = 3

      // Compressor — prevent clipping after gain
      const comp = ctx.createDynamicsCompressor()
      comp.threshold.value = -18
      comp.knee.value = 10
      comp.ratio.value = 4
      comp.attack.value = 0.003
      comp.release.value = 0.15

      // Destination node → provides a MediaStream for MediaRecorder
      const dest = ctx.createMediaStreamDestination()

      source.connect(gain)
      gain.connect(hp)
      hp.connect(mid1)
      mid1.connect(mid2)
      mid2.connect(shelf)
      shelf.connect(comp)
      comp.connect(dest)

      // VAD reads from the processed signal (after gain, for accurate RMS)
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      comp.connect(analyser)
      analyserRef.current = analyser

      recordingStreamRef.current = dest.stream
    } else {
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      source.connect(analyser)
      analyserRef.current = analyser
      recordingStreamRef.current = null
    }

    // WebSocket connection
    const ws = new WebSocket(BACKEND_WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      // Send config
      ws.send(JSON.stringify({
        model: settings.whisperModel,
        language: settings.transcribeLanguage || null
      }))
      setStatus('listening')
      rafRef.current = requestAnimationFrame(vadLoop)
    }

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string)
        if (msg.type === 'segment') {
          addSegment(msg.text as string)
        } else if (msg.type === 'done') {
          if (isActiveRef.current) setStatus('listening')
        } else if (msg.type === 'error') {
          setError(msg.message as string)
          setStatus('error')
        } else if (msg.type === 'busy') {
          // Model is occupied by a concurrent chunk — silently drop this chunk.
          // This is normal when partial flushes overlap with transcription time.
          if (isActiveRef.current) setStatus('listening')
        }
      } catch {
        // ignore malformed messages
      }
    }

    ws.onerror = () => {
      setError('WebSocket 연결 오류가 발생했습니다.')
      setStatus('error')
    }

    ws.onclose = () => {
      if (isActiveRef.current) {
        // Keep 'error' status if onmessage already set it; otherwise go idle
        setStatus((prev) => (prev === 'error' ? 'error' : 'idle'))
        isActiveRef.current = false
      }
    }
  }, [settings.whisperModel, settings.audioDeviceId, settings.realtimeEnhance, settings.transcribeLanguage, vadLoop, addSegment])

  // ── Stop session ────────────────────────────────────────────────────────────
  const stop = useCallback(() => {
    isActiveRef.current = false
    isSpeakingRef.current = false

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (silenceTimerRef.current !== null) {
      clearTimeout(silenceTimerRef.current)
      silenceTimerRef.current = null
    }
    if (partialIntervalRef.current !== null) {
      clearInterval(partialIntervalRef.current)
      partialIntervalRef.current = null
    }

    const mr = mediaRecorderRef.current
    if (mr && mr.state === 'recording') {
      mr.onstop = () => { chunksRef.current = [] }
      mr.stop()
    }
    mediaRecorderRef.current = null

    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    recordingStreamRef.current = null

    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null

    wsRef.current?.close()
    wsRef.current = null

    setIsSpeaking(false)
    setStatus('idle')
  }, [])

  // Clean up on unmount
  useEffect(() => {
    return () => {
      isActiveRef.current = false
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
      if (silenceTimerRef.current !== null) clearTimeout(silenceTimerRef.current)
      if (partialIntervalRef.current !== null) clearInterval(partialIntervalRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close()
      wsRef.current?.close()
    }
  }, [])

  const clearSegments = useCallback(() => setSegments([]), [])

  const isRecording = status !== 'idle' && status !== 'error'

  return {
    status,
    segments,
    error,
    isRecording,
    isSpeaking,
    translateMode,
    setTranslateMode,
    start,
    stop,
    clearSegments
  }
}
