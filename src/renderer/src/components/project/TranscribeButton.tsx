import { useSettingsStore } from '../../store/settingsStore'
import { ProgressBar } from '../ui/ProgressBar'
import type { ProjectStatus } from '../../../../shared/types'

interface TranscribeButtonProps {
  projectStatus: ProjectStatus
  isTranscribing: boolean
  receivedSegments: number
  progressPct: number
  transcribeError: string | null
  onStart: () => void
  onCancel: () => void
}

export function TranscribeButton({
  projectStatus,
  isTranscribing,
  receivedSegments,
  progressPct,
  transcribeError,
  onStart,
  onCancel,
}: TranscribeButtonProps) {
  const model = useSettingsStore((s) => s.settings.whisperModel)

  if (isTranscribing) {
    const isLoadingModel = receivedSegments === 0
    return (
      <div className="space-y-2 py-1">
        <ProgressBar
          value={progressPct}
          label={
            isLoadingModel
              ? `모델 로딩 중... (${model} — 첫 실행 시 다운로드 필요)`
              : `전사 중... ${progressPct}% (${receivedSegments}개 세그먼트)`
          }
        />
        {isLoadingModel && (
          <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 animate-pulse rounded-full" style={{ width: '100%' }} />
          </div>
        )}
        {isLoadingModel && (
          <p className="text-xs text-zinc-500 text-center">
            모델을 처음 사용할 때 HuggingFace에서 자동 다운로드됩니다.
            <br />
            인터넷 연결을 확인하고 잠시 기다려주세요.
          </p>
        )}
        <button
          onClick={onCancel}
          className="w-full border border-red-800/60 hover:border-red-600 text-red-400 hover:text-red-300 text-sm rounded-lg py-2 transition-colors"
        >
          전사 중단
        </button>
      </div>
    )
  }

  if (projectStatus === 'done') {
    return (
      <button
        onClick={onStart}
        className="w-full border border-zinc-600 hover:border-zinc-400 text-zinc-400 hover:text-white text-sm rounded-lg py-2 transition-colors"
      >
        재전사 ({model})
      </button>
    )
  }

  return (
    <div className="space-y-2">
      {transcribeError && (
        <div className="text-xs text-red-400 bg-red-950/50 border border-red-800/50 rounded-lg p-2.5 font-mono break-all leading-relaxed">
          <div className="text-red-300 font-sans font-medium mb-1">전사 오류</div>
          {transcribeError}
        </div>
      )}
      <button
        onClick={onStart}
        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
      >
        {projectStatus === 'error' ? `재시도 (${model})` : `전사 시작 (${model})`}
      </button>
    </div>
  )
}
