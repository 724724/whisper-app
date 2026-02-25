import { create } from 'zustand'
import type { Transcript, TranscriptSegment } from '../../../shared/types'

interface TranscribeProgress {
  jobId: string | null
  receivedSegments: number
  lastSegmentEndMs: number
}

interface TranscriptStore {
  transcript: Transcript | null
  activeSegmentId: string | null
  isTranscribing: boolean
  transcribeProgress: TranscribeProgress
  setTranscript: (transcript: Transcript | null) => void
  setActiveSegmentId: (id: string | null) => void
  setTranscribing: (value: boolean) => void
  setTranscribeProgress: (progress: TranscribeProgress) => void
  addSegment: (segment: TranscriptSegment) => void
  updateSegmentTranslation: (segmentId: string, translatedText: string) => void
  deleteSegment: (segmentId: string) => void
  replaceSegment: (oldSegmentId: string, newSegments: TranscriptSegment[]) => void
}

export const useTranscriptStore = create<TranscriptStore>((set) => ({
  transcript: null,
  activeSegmentId: null,
  isTranscribing: false,
  transcribeProgress: { jobId: null, receivedSegments: 0, lastSegmentEndMs: 0 },
  setTranscript: (transcript) => set({ transcript }),
  setActiveSegmentId: (id) => set({ activeSegmentId: id }),
  setTranscribing: (value) => set({ isTranscribing: value }),
  setTranscribeProgress: (progress) => set({ transcribeProgress: progress }),
  addSegment: (segment) =>
    set((s) => {
      if (!s.transcript) return s
      return {
        transcript: {
          ...s.transcript,
          segments: [...s.transcript.segments, segment],
        },
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
          ),
        },
      }
    }),
  deleteSegment: (segmentId) =>
    set((s) => {
      if (!s.transcript) return s
      return {
        transcript: {
          ...s.transcript,
          segments: s.transcript.segments.filter((seg) => seg.id !== segmentId),
        },
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
    }),
}))
