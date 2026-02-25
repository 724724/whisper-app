import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useParams } from 'react-router-dom'
import { Box, Typography, ButtonGroup, Button } from '@mui/material'
import { MediaPlayer } from '../components/project/MediaPlayer'
import { TranscriptPanel } from '../components/project/TranscriptPanel'
import { TranscribeButton } from '../components/project/TranscribeButton'
import { TranslationPanel } from '../components/project/TranslationPanel'
import { ModelDownloadDialog } from '../components/project/ModelDownloadDialog'
import { useMediaPlayer } from '../hooks/useMediaPlayer'
import { useTranscribe } from '../hooks/useTranscribe'
import { useTranslate } from '../hooks/useTranslate'
import { useTranscriptStore } from '../store/transcriptStore'
import { useProjectStore } from '../store/projectStore'
import { useSettingsStore } from '../store/settingsStore'

export function ProjectPage(): ReactNode {
  const { id } = useParams<{ id: string }>()
  const [mediaUrl, setMediaUrl] = useState('')

  const project = useProjectStore((s) => s.projects.find((p) => p.id === id) ?? null)
  const addProject = useProjectStore((s) => s.addProject)

  const {
    mediaRef,
    currentTimeMs,
    isPlaying,
    duration,
    playbackRate,
    seekTo,
    seekToOnly,
    togglePlay,
    setPlaybackRate,
    handleTimeUpdate,
    handlePlay,
    handlePause,
    handleDurationChange
  } = useMediaPlayer()
  const {
    isTranscribing,
    startTranscribe,
    transcribeError,
    cancelTranscribe,
    retranscribeSegment,
    retranscribingSegmentId,
    downloadInfo
  } = useTranscribe()
  const { isTranslating, error: translateError, translateFull, translateSegment } = useTranslate()

  const transcript = useTranscriptStore((s) => s.transcript)
  const activeSegmentId = useTranscriptStore((s) => s.activeSegmentId)
  const setTranscript = useTranscriptStore((s) => s.setTranscript)
  const deleteSegment = useTranscriptStore((s) => s.deleteSegment)
  const transcribeProgress = useTranscriptStore((s) => s.transcribeProgress)
  const translateProgress = useTranscriptStore((s) => s.translateProgress)
  const outputLanguage = useSettingsStore((s) => s.settings.outputLanguage)

  useEffect(() => {
    if (!id) return
    const load = async (): Promise<void> => {
      let proj = useProjectStore.getState().projects.find((p) => p.id === id)
      if (!proj) {
        const fetched = await window.api.getProject({ projectId: id })
        if (!fetched) return
        addProject(fetched)
        proj = fetched
      }
      const { url } = await window.api.getMediaUrl({ storedFilePath: proj.storedFilePath })
      setMediaUrl(url)
      if (proj.transcriptId) {
        const t = await window.api.getTranscript({ transcriptId: proj.transcriptId })
        if (t) setTranscript(t)
      }
    }
    load()
    return () => setTranscript(null)
  }, [id, addProject, setTranscript])

  const handleStartTranscribe = (): void => {
    if (!project) return
    startTranscribe(project.id, project.storedFilePath)
  }

  const handleDeleteSegment = async (segmentId: string): Promise<void> => {
    if (!transcript) return
    deleteSegment(segmentId)
    const updated = {
      ...transcript,
      segments: transcript.segments.filter((s) => s.id !== segmentId)
    }
    await window.api.saveTranscript(updated)
  }

  const handleDeleteSegments = async (ids: string[]): Promise<void> => {
    if (!transcript) return
    const idSet = new Set(ids)
    ids.forEach((id) => deleteSegment(id))
    const updated = { ...transcript, segments: transcript.segments.filter((s) => !idSet.has(s.id)) }
    await window.api.saveTranscript(updated)
  }

  const handleRetranscribeSegment = (
    segment: import('../../../shared/types').TranscriptSegment
  ): void => {
    if (!project) return
    retranscribeSegment(project.id, project.storedFilePath, segment)
  }

  const progressPct =
    duration > 0 && transcribeProgress.lastSegmentEndMs > 0
      ? Math.min(Math.round((transcribeProgress.lastSegmentEndMs / duration) * 100), 99)
      : 0

  const hasTranslation = transcript?.segments.some((s) => s.translatedText) ?? false
  const canExport = !!transcript && transcript.segments.length > 0 && !isTranscribing

  const handleExport = async (format: 'txt' | 'srt' | 'csv'): Promise<void> => {
    if (!transcript || !project) return
    await window.api.exportTranscript({
      segments: transcript.segments,
      projectName: project.name,
      format,
      hasTranslation
    })
  }

  if (!project) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <Typography color="text.secondary">프로젝트를 불러오는 중...</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <ModelDownloadDialog info={downloadInfo} />
      {/* Left panel */}
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          borderRight: 1,
          borderColor: 'divider',
          display: 'flex',
          flexDirection: 'column',
          p: 2,
          gap: 2,
          overflowY: 'auto'
        }}
      >
        <Box>
          <Typography variant="subtitle2" fontWeight="bold" noWrap>
            {project.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {project.originalFileName}
          </Typography>
        </Box>

        {mediaUrl && (
          <MediaPlayer
            mediaUrl={mediaUrl}
            mediaType={project.mediaType}
            mediaRef={mediaRef}
            currentTimeMs={currentTimeMs}
            duration={duration}
            isPlaying={isPlaying}
            playbackRate={playbackRate}
            onTogglePlay={togglePlay}
            onSeek={seekTo}
            onSpeedChange={setPlaybackRate}
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
          chunkProgress={transcribeProgress.chunkProgress}
          transcribeError={transcribeError}
          onStart={handleStartTranscribe}
          onCancel={cancelTranscribe}
        />

        <TranslationPanel
          hasTranscript={!!transcript && transcript.segments.length > 0 && !isTranscribing}
          hasTranslation={hasTranslation}
          isTranslating={isTranslating}
          translateProgress={translateProgress}
          error={translateError}
          outputLanguage={outputLanguage}
          onTranslateFull={translateFull}
        />
      </Box>

      {/* Right panel */}
      <Box
        sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}
      >
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0
          }}
        >
          <Typography variant="body2" fontWeight="medium">
            전사 결과
            {transcript && ` (${transcript.segments.length}개 세그먼트)`}
            {transcript?.targetLanguage && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                번역: {transcript.targetLanguage}
              </Typography>
            )}
          </Typography>
          {canExport && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mr: 0.5 }}>
                내보내기
              </Typography>
              <ButtonGroup size="small" variant="outlined">
                {(['txt', 'srt', 'csv'] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    onClick={() => handleExport(fmt)}
                    sx={{ px: 1, fontSize: '0.7rem', textTransform: 'uppercase' }}
                  >
                    {fmt}
                  </Button>
                ))}
              </ButtonGroup>
            </Box>
          )}
        </Box>

        {/* TranscriptPanel is now the scroll container itself */}
        <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
          <TranscriptPanel
            transcript={transcript}
            activeSegmentId={activeSegmentId}
            isTranscribing={isTranscribing}
            receivedSegments={transcribeProgress.receivedSegments}
            onSeekOnly={seekToOnly}
            onTranslateSegment={translateSegment}
            onDeleteSegment={handleDeleteSegment}
            onDeleteSegments={handleDeleteSegments}
            onRetranscribeSegment={handleRetranscribeSegment}
            retranscribingSegmentId={retranscribingSegmentId}
          />
        </Box>
      </Box>
    </Box>
  )
}
