import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MediaPlayer } from '../components/project/MediaPlayer'
import { TranscriptPanel } from '../components/project/TranscriptPanel'
import { TranscribeButton } from '../components/project/TranscribeButton'
import { TranslationPanel } from '../components/project/TranslationPanel'
import { useMediaPlayer } from '../hooks/useMediaPlayer'
import { useTranscribe } from '../hooks/useTranscribe'
import { useTranslate } from '../hooks/useTranslate'
import { useTranscriptStore } from '../store/transcriptStore'
import { useProjectStore } from '../store/projectStore'
import { useSettingsStore } from '../store/settingsStore'

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const [mediaUrl, setMediaUrl] = useState('')

  // Read project from the store — reactive to status updates from useTranscribe
  const project = useProjectStore((s) => s.projects.find((p) => p.id === id) ?? null)
  const addProject = useProjectStore((s) => s.addProject)

  const { mediaRef, currentTimeMs, isPlaying, duration, seekTo, togglePlay, handleTimeUpdate, handlePlay, handlePause, handleDurationChange } = useMediaPlayer()
  const { isTranscribing, startTranscribe, transcribeError, cancelTranscribe } = useTranscribe()
  const { isTranslating, error: translateError, translateFull, translateSegment } = useTranslate()

  const transcript = useTranscriptStore((s) => s.transcript)
  const activeSegmentId = useTranscriptStore((s) => s.activeSegmentId)
  const setTranscript = useTranscriptStore((s) => s.setTranscript)
  const transcribeProgress = useTranscriptStore((s) => s.transcribeProgress)
  const outputLanguage = useSettingsStore((s) => s.settings.outputLanguage)

  useEffect(() => {
    if (!id) return

    const load = async () => {
      // Load project if not already in store (e.g., direct navigation without going through HomePage)
      let proj = useProjectStore.getState().projects.find((p) => p.id === id)
      if (!proj) {
        const fetched = await window.api.getProject({ projectId: id })
        if (!fetched) return
        addProject(fetched)
        proj = fetched
      }

      const { url } = await window.api.getMediaUrl({ storedFilePath: proj.storedFilePath })
      setMediaUrl(url)

      // Load existing transcript if this project was already transcribed
      if (proj.transcriptId) {
        const t = await window.api.getTranscript({ transcriptId: proj.transcriptId })
        if (t) setTranscript(t)
      }
    }

    load()
    return () => setTranscript(null)
  }, [id, addProject, setTranscript])

  const handleStartTranscribe = () => {
    if (!project) return
    startTranscribe(project.id, project.storedFilePath)
  }

  // Compute progress % from last received segment end time vs media duration
  const progressPct =
    duration > 0 && transcribeProgress.lastSegmentEndMs > 0
      ? Math.min(Math.round((transcribeProgress.lastSegmentEndMs / duration) * 100), 99)
      : 0

  const hasTranslation = transcript?.segments.some((s) => s.translatedText) ?? false
  const canExport = !!transcript && transcript.segments.length > 0 && !isTranscribing

  const handleExport = async (format: 'txt' | 'srt' | 'csv') => {
    if (!transcript || !project) return
    await window.api.exportTranscript({
      segments: transcript.segments,
      projectName: project.name,
      format,
      hasTranslation,
    })
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600">
        프로젝트를 불러오는 중...
      </div>
    )
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left panel: media + controls */}
      <div className="w-80 shrink-0 border-r border-zinc-800 flex flex-col p-4 gap-4 overflow-y-auto">
        <div>
          <h1 className="font-semibold text-white truncate mb-1">{project.name}</h1>
          <p className="text-xs text-zinc-500">{project.originalFileName}</p>
        </div>

        {mediaUrl && (
          <MediaPlayer
            mediaUrl={mediaUrl}
            mediaType={project.mediaType}
            mediaRef={mediaRef}
            currentTimeMs={currentTimeMs}
            duration={duration}
            isPlaying={isPlaying}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onTimeUpdate={handleTimeUpdate}
            onPlay={handlePlay}
            onPause={handlePause}
            onDurationChange={handleDurationChange}
          />
        )}

        <TranscribeButton
          projectStatus={project.status}
          isTranscribing={isTranscribing}
          receivedSegments={transcribeProgress.receivedSegments}
          progressPct={progressPct}
          transcribeError={transcribeError}
          onStart={handleStartTranscribe}
          onCancel={cancelTranscribe}
        />

        <TranslationPanel
          hasTranscript={!!transcript && transcript.segments.length > 0 && !isTranscribing}
          hasTranslation={hasTranslation}
          isTranslating={isTranslating}
          error={translateError}
          outputLanguage={outputLanguage}
          onTranslateFull={translateFull}
        />
      </div>

      {/* Right panel: transcript */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
          <span className="text-sm font-medium text-zinc-300">
            전사 결과
            {transcript && ` (${transcript.segments.length}개 세그먼트)`}
            {transcript?.targetLanguage && (
              <span className="text-xs text-zinc-500 ml-2">번역: {transcript.targetLanguage}</span>
            )}
          </span>
          {canExport && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-600 mr-1">내보내기</span>
              {(['txt', 'srt', 'csv'] as const).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => handleExport(fmt)}
                  className="text-xs px-2 py-1 rounded border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white transition-colors uppercase"
                >
                  {fmt}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <TranscriptPanel
            transcript={transcript}
            activeSegmentId={activeSegmentId}
            isTranscribing={isTranscribing}
            receivedSegments={transcribeProgress.receivedSegments}
            onSeek={seekTo}
            onTranslateSegment={translateSegment}
          />
        </div>
      </div>
    </div>
  )
}
