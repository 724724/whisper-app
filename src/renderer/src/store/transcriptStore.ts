import { create } from 'zustand'
import type { Transcript, TranscriptSegment } from '../../../shared/types'

interface TranscribeProgress {
  jobId: string | null
  receivedSegments: number
  lastSegmentEndMs: number
  chunkProgress: { current: number; total: number } | null
}

interface TranslateProgress {
  current: number
  total: number
}

interface TranscriptStore {
  transcript: Transcript | null
  activeSegmentId: string | null
  isTranscribing: boolean
  transcribeProgress: TranscribeProgress
  translateProgress: TranslateProgress | null
  setTranscript: (transcript: Transcript | null) => void
  setActiveSegmentId: (id: string | null) => void
  setTranscribing: (value: boolean) => void
  setTranscribeProgress: (progress: TranscribeProgress) => void
  setTranslateProgress: (progress: TranslateProgress | null) => void
  addSegment: (segment: TranscriptSegment) => void
  addSegments: (segments: TranscriptSegment[]) => void
  updateSegmentTranslation: (segmentId: string, translatedText: string) => void
  updateSegmentsTranslation: (updates: { id: string; translatedText: string }[]) => void
  deleteSegment: (segmentId: string) => void
  replaceSegment: (oldSegmentId: string, newSegments: TranscriptSegment[]) => void
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  transcript: null,
  activeSegmentId: null,
  isTranscribing: false,
  transcribeProgress: {
    jobId: null,
    receivedSegments: 0,
    lastSegmentEndMs: 0,
    chunkProgress: null
  },
  translateProgress: null,
  setTranscript: (transcript) => set({ transcript }),
  setActiveSegmentId: (id) => set({ activeSegmentId: id }),
  setTranscribing: (value) => set({ isTranscribing: value }),
  setTranscribeProgress: (progress) => set({ transcribeProgress: progress }),
  setTranslateProgress: (progress) => set({ translateProgress: progress }),
  addSegment: (segment) =>
    set((s) => {
      if (!s.transcript) return s
      return {
        transcript: {
          ...s.transcript,
          segments: [...s.transcript.segments, segment]
        }
      }
    }),
  addSegments: (newSegments) =>
    set((s) => {
      if (!s.transcript) return s
      return {
        transcript: {
          ...s.transcript,
          segments: [...s.transcript.segments, ...newSegments]
        }
      }
    }),
  updateSegmentTranslation: (segmentId, translatedText) =>
    set((s) => {
      if (!s.transcript) return s
      return {
        transcript: {
          ...s.transcript,
          segments: s.transcript.segments.map((seg) =>
            seg.id === segmentId ? { ...seg, translatedText } : seg
          )
        }
      }
    }),
  updateSegmentsTranslation: (updates) =>
    set((s) => {
      if (!s.transcript) return s
      const map = new Map(updates.map((u) => [u.id, u.translatedText]))
      return {
        transcript: {
          ...s.transcript,
          segments: s.transcript.segments.map((seg) =>
            map.has(seg.id) ? { ...seg, translatedText: map.get(seg.id)! } : seg
          )
        }
      }
    }),
  deleteSegment: (segmentId) =>
    set((s) => {
      if (!s.transcript) return s
      return {
        transcript: {
          ...s.transcript,
          segments: s.transcript.segments.filter((seg) => seg.id !== segmentId)
        }
      }
    }),
  replaceSegment: (oldSegmentId, newSegments) =>
    set((s) => {
      if (!s.transcript) return s
      const segments = s.transcript.segments.flatMap((seg) =>
        seg.id === oldSegmentId ? newSegments : [seg]
      )
      segments.sort((a, b) => a.startMs - b.startMs)
      return { transcript: { ...s.transcript, segments } }
    })
}))
