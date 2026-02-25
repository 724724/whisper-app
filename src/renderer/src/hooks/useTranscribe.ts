import { useCallback, useRef, useState } from 'react'
import { nanoid } from 'nanoid'
import { useTranscriptStore } from '../store/transcriptStore'
import { useProjectStore } from '../store/projectStore'
import { useSettingsStore } from '../store/settingsStore'
import { backendFetch } from './useBackend'
import type { Transcript, TranscriptSegment, WhisperModelName } from '../../../shared/types'

export interface ModelDownloadInfo {
  model: string
  percent: number
  sizeMb: number
}

export interface UseTranscribeResult {
  isTranscribing: boolean
  startTranscribe: (projectId: string, storedFilePath: string, modelName?: string) => Promise<void>
  transcribeError: string | null
  cancelTranscribe: () => Promise<void>
  retranscribeSegment: (
    _projectId: string,
    storedFilePath: string,
    segment: TranscriptSegment
  ) => Promise<void>
  retranscribingSegmentId: string | null
  downloadInfo: ModelDownloadInfo | null
}

export function useTranscribe(): UseTranscribeResult {
  const {
    isTranscribing,
    setTranscribing,
    setTranscript,
    setTranscribeProgress,
    addSegments,
    replaceSegment
  } = useTranscriptStore()
  const { updateProject } = useProjectStore()
  const settings = useSettingsStore((s) => s.settings)
  const [transcribeError, setTranscribeError] = useState<string | null>(null)
  const [retranscribingSegmentId, setRetranscribingSegmentId] = useState<string | null>(null)
  const [downloadInfo, setDownloadInfo] = useState<ModelDownloadInfo | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const currentJobIdRef = useRef<string | null>(null)
  const isCancelledRef = useRef(false)
  // Stored resolve from the SSE promise — called directly by cancelTranscribe
  // because EventSource.close() does NOT trigger onerror
  const cancelResolveRef = useRef<(() => void) | null>(null)

  const cancelTranscribe = useCallback(async () => {
    isCancelledRef.current = true
    // Close the EventSource first (stops receiving new events)
    eventSourceRef.current?.close()
    eventSourceRef.current = null
    // Directly resolve the pending SSE Promise — onerror won't fire on manual close
    cancelResolveRef.current?.()
    cancelResolveRef.current = null
    // Signal backend to stop processing
    const jobId = currentJobIdRef.current
    if (jobId) {
      try {
        await backendFetch(`/transcribe/${jobId}`, { method: 'DELETE' })
      } catch {
        // ignore — backend may have already finished
      }
    }
  }, [])

  const startTranscribe = useCallback(
    async (projectId: string, storedFilePath: string, modelName?: string) => {
      const model = modelName ?? settings.whisperModel

      setTranscribeError(null)
      isCancelledRef.current = false
      cancelResolveRef.current = null
      setTranscribing(true)
      setTranscribeProgress({
        jobId: null,
        receivedSegments: 0,
        lastSegmentEndMs: 0,
        chunkProgress: null
      })

      // Update project status
      const updatedProject = await window.api.updateProject({
        id: projectId,
        status: 'processing',
        modelUsed: model as WhisperModelName
      })
      updateProject(updatedProject)

      // Initialize empty transcript
      const transcriptId = nanoid()
      const emptyTranscript: Transcript = {
        id: transcriptId,
        projectId,
        segments: [],
        rawText: '',
        targetLanguage: null
      }
      setTranscript(emptyTranscript)

      let batchInterval: ReturnType<typeof setInterval> | null = null
      try {
        // Start transcription on backend
        const startRes = await backendFetch('/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file_path: storedFilePath, model })
        })

        if (!startRes.ok) {
          throw new Error(`Backend error: ${startRes.status}`)
        }

        const { job_id: jobId } = (await startRes.json()) as { job_id: string }
        currentJobIdRef.current = jobId
        setTranscribeProgress({
          jobId,
          receivedSegments: 0,
          lastSegmentEndMs: 0,
          chunkProgress: null
        })

        // Stream results via SSE
        const segments: TranscriptSegment[] = []
        let detectedLanguage = ''
        let currentChunkProgress: { current: number; total: number } | null = null

        // Batch segment additions: flush to store every 200ms instead of per-segment
        // to avoid React re-rendering hundreds of items on each individual segment arrival
        const pendingBatch: TranscriptSegment[] = []
        const flushBatch = (): void => {
          if (pendingBatch.length === 0) return
          const toFlush = pendingBatch.splice(0)
          addSegments(toFlush)
          setTranscribeProgress({
            jobId,
            receivedSegments: segments.length,
            lastSegmentEndMs: segments[segments.length - 1]?.endMs ?? 0,
            chunkProgress: currentChunkProgress
          })
        }
        batchInterval = setInterval(flushBatch, 200)

        await new Promise<void>((resolve, reject) => {
          // Store resolve so cancelTranscribe can unblock this promise directly
          cancelResolveRef.current = resolve

          const eventSource = new EventSource(`http://127.0.0.1:18765/transcribe/${jobId}/stream`)
          eventSourceRef.current = eventSource

          eventSource.onmessage = (e) => {
            if (isCancelledRef.current) return
            const data = JSON.parse(e.data) as Record<string, unknown>

            if (data.type === 'model_downloading') {
              setDownloadInfo({
                model: data.model as string,
                percent: data.percent as number,
                sizeMb: data.size_mb as number
              })
            } else if (data.type === 'model_loaded') {
              setDownloadInfo(null)
            } else if (data.type === 'segment') {
              const seg: TranscriptSegment = {
                id: String(data.id),
                startMs: Math.round((data.start as number) * 1000),
                endMs: Math.round((data.end as number) * 1000),
                text: data.text as string,
                translatedText: null
              }
              segments.push(seg)
              pendingBatch.push(seg)
            } else if (data.type === 'chunk_progress') {
              flushBatch()
              currentChunkProgress = {
                current: data.chunk as number,
                total: data.total as number
              }
              setTranscribeProgress({
                jobId,
                receivedSegments: segments.length,
                lastSegmentEndMs: segments.length > 0 ? segments[segments.length - 1].endMs : 0,
                chunkProgress: currentChunkProgress
              })
            } else if (data.type === 'done') {
              detectedLanguage = (data.language as string) ?? ''
              clearInterval(batchInterval!)
              batchInterval = null
              flushBatch()
              eventSource.close()
              eventSourceRef.current = null
              cancelResolveRef.current = null
              resolve()
            } else if (data.type === 'error') {
              clearInterval(batchInterval!)
              batchInterval = null
              eventSource.close()
              eventSourceRef.current = null
              cancelResolveRef.current = null
              reject(new Error(data.message as string))
            }
          }

          eventSource.onerror = () => {
            // Only fires on unexpected connection loss (NOT on manual close)
            clearInterval(batchInterval!)
            batchInterval = null
            eventSource.close()
            eventSourceRef.current = null
            cancelResolveRef.current = null
            if (isCancelledRef.current) {
              resolve()
            } else {
              reject(new Error('SSE 연결 오류'))
            }
          }
        })

        if (isCancelledRef.current) {
          const cancelled = await window.api.updateProject({ id: projectId, status: 'pending' })
          updateProject(cancelled)
          return
        }

        // Build final transcript
        const finalTranscript: Transcript = {
          id: transcriptId,
          projectId,
          segments,
          rawText: segments.map((s) => s.text).join(' '),
          targetLanguage: null
        }
        setTranscript(finalTranscript)
        await window.api.saveTranscript(finalTranscript)

        // Update project
        const done = await window.api.updateProject({
          id: projectId,
          status: 'done',
          transcriptId,
          language: detectedLanguage,
          modelUsed: model as WhisperModelName
        })
        updateProject(done)
      } catch (err) {
        if (isCancelledRef.current) {
          const cancelled = await window.api.updateProject({ id: projectId, status: 'pending' })
          updateProject(cancelled)
        } else {
          const msg = (err as Error).message
          setTranscribeError(msg)
          console.error('Transcription error:', msg)
          const failed = await window.api.updateProject({ id: projectId, status: 'error' })
          updateProject(failed)
        }
      } finally {
        if (batchInterval) {
          clearInterval(batchInterval)
          batchInterval = null
        }
        setTranscribing(false)
        setDownloadInfo(null)
        setTranscribeProgress({
          jobId: null,
          receivedSegments: 0,
          lastSegmentEndMs: 0,
          chunkProgress: null
        })
        currentJobIdRef.current = null
        cancelResolveRef.current = null
      }
    },
    [
      settings.whisperModel,
      setTranscribing,
      setTranscript,
      setTranscribeProgress,
      addSegments,
      updateProject
    ]
  )

  const retranscribeSegment = useCallback(
    async (_projectId: string, storedFilePath: string, segment: TranscriptSegment) => {
      const model = settings.whisperModel
      setRetranscribingSegmentId(segment.id)

      try {
        const startRes = await backendFetch('/transcribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file_path: storedFilePath,
            model,
            start_ms: segment.startMs,
            end_ms: segment.endMs
          })
        })

        if (!startRes.ok) throw new Error(`Backend error: ${startRes.status}`)

        const { job_id: jobId } = (await startRes.json()) as { job_id: string }

        const newSegments: TranscriptSegment[] = []

        await new Promise<void>((resolve, reject) => {
          const eventSource = new EventSource(`http://127.0.0.1:18765/transcribe/${jobId}/stream`)

          eventSource.onmessage = (e) => {
            const data = JSON.parse(e.data) as Record<string, unknown>

            if (data.type === 'segment') {
              newSegments.push({
                id: nanoid(),
                startMs: Math.round((data.start as number) * 1000),
                endMs: Math.round((data.end as number) * 1000),
                text: data.text as string,
                translatedText: null
              })
            } else if (data.type === 'done') {
              eventSource.close()
              resolve()
            } else if (data.type === 'error') {
              eventSource.close()
              reject(new Error(data.message as string))
            }
          }

          eventSource.onerror = () => {
            eventSource.close()
            reject(new Error('SSE 연결 오류'))
          }
        })

        // Replace original segment with new ones (or keep original if nothing returned)
        const replacement = newSegments.length > 0 ? newSegments : [segment]
        replaceSegment(segment.id, replacement)

        // Save updated transcript
        const currentTranscript = useTranscriptStore.getState().transcript
        if (currentTranscript) {
          await window.api.saveTranscript(currentTranscript)
        }
      } catch (err) {
        console.error('Re-transcription error:', (err as Error).message)
      } finally {
        setRetranscribingSegmentId(null)
      }
    },
    [settings.whisperModel, replaceSegment]
  )

  return {
    isTranscribing,
    startTranscribe,
    transcribeError,
    cancelTranscribe,
    retranscribeSegment,
    retranscribingSegmentId,
    downloadInfo
  }
}
