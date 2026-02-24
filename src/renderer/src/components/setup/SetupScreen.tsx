import { useEffect, useRef } from 'react'
import { useBackendStore } from '../../store/backendStore'
import { ProgressBar } from '../ui/ProgressBar'
import { Spinner } from '../ui/Spinner'

const PHASE_LABELS: Record<string, string> = {
  checking: 'Python 환경 확인 중',
  installing: '패키지 설치 중',
  starting: '서버 시작 중',
  ready: '준비 완료',
  error: '오류 발생',
}

export function SetupScreen() {
  const { status, logs } = useBackendStore()
  const isError = status.phase === 'error'
  const logRef = useRef<HTMLDivElement>(null)

  // Auto-scroll log to bottom as new lines arrive
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [logs])

  return (
    <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-6">
      <div className="flex flex-col items-center gap-3 mb-2">
        <div className="text-4xl font-bold text-white tracking-tight">Whisper App</div>
        <div className="text-zinc-400 text-sm">AI 기반 음성 텍스트 변환</div>
      </div>

      <div className="w-96 flex flex-col items-center gap-4">
        {!isError && <Spinner size="lg" />}

        {isError ? (
          <div className="text-center w-full">
            <div className="text-red-400 font-medium mb-2">시작 실패</div>
            <div className="text-zinc-400 text-xs leading-relaxed whitespace-pre-wrap text-left max-h-48 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-800 p-2.5 font-mono">
              {status.message}
            </div>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="text-white font-medium">{PHASE_LABELS[status.phase]}</div>
              <div className="text-zinc-400 text-sm mt-1">{status.message}</div>
            </div>
            {status.progress !== undefined && (
              <ProgressBar value={status.progress} className="w-full" />
            )}
          </>
        )}

        {/* Scrollable log of recent status messages */}
        {logs.length > 0 && (
          <div
            ref={logRef}
            className="w-full max-h-36 overflow-y-auto rounded-lg bg-zinc-900 border border-zinc-800 p-2.5"
          >
            {logs.map((line, i) => (
              <div
                key={i}
                className={`text-xs font-mono leading-relaxed py-0.5 ${
                  line.includes('[error]') ? 'text-red-400' : 'text-zinc-500'
                }`}
              >
                {line}
              </div>
            ))}
          </div>
        )}

        {isError && (
          <div className="text-xs text-zinc-500 text-center mt-2">
            Python 3.8+ 및 ffmpeg가 설치되어 있는지 확인하세요.
            <br />
            앱을 재시작하면 다시 시도합니다.
          </div>
        )}
      </div>
    </div>
  )
}
