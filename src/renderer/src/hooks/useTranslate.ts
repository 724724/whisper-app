import { useCallback, useState } from 'react'
import { useTranscriptStore } from '../store/transcriptStore'
import { useSettingsStore } from '../store/settingsStore'

export function useTranslate() {
  const [isTranslating, setIsTranslating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { transcript, updateSegmentTranslation, updateSegmentsTranslation, setTranscript, setTranslateProgress } =
    useTranscriptStore()
  const settings = useSettingsStore((s) => s.settings)

  const translateFull = useCallback(async () => {
    if (!transcript) return
    setIsTranslating(true)
    setError(null)
    setTranslateProgress({ current: 0, total: transcript.segments.length })
    try {
      // ── Listen for progress events ──
      const unsubscribe = window.api.onTranslateProgress((data) => {
        if (!data.success) {
          setError('부분 번역 실패')
          return
        }
        updateSegmentsTranslation(data.translatedSegments)
        setTranslateProgress(data.progress)
      })

      const result = await window.api.translateFull({
        transcriptId: transcript.id,
        targetLang: settings.outputLanguage,
        segments: transcript.segments // fallback if transcript not yet in store
      })

      unsubscribe()

      if (!result.success) {
        setError(result.error ?? '번역 실패')
        return
      }
      // Apply translations to store (final pass — ensures nothing was missed)
      if (result.translatedSegments?.length) {
        updateSegmentsTranslation(result.translatedSegments)
      }
      setTranscript({ ...transcript, targetLanguage: settings.outputLanguage })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setIsTranslating(false)
      setTranslateProgress(null)
    }
  }, [
    transcript,
    settings.outputLanguage,
    updateSegmentsTranslation,
    setTranscript,
    setTranslateProgress
  ])

  const translateSegment = useCallback(
    async (segmentId: string) => {
      if (!transcript) return
      setError(null)
      try {
        const result = await window.api.translateSegment({
          transcriptId: transcript.id,
          segmentId,
          targetLang: settings.outputLanguage,
          segments: transcript.segments // fallback if transcript not yet in store
        })
        if (!result.success) {
          setError(result.error ?? '번역 실패')
          return
        }
        result.translatedSegments?.forEach(({ id, translatedText }) => {
          updateSegmentTranslation(id, translatedText)
        })
      } catch (err) {
        setError((err as Error).message)
      }
    },
    [transcript, settings.outputLanguage, updateSegmentTranslation]
  )

  return { isTranslating, error, translateFull, translateSegment }
}
