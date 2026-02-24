import { Spinner } from '../ui/Spinner'

interface TranslationPanelProps {
  hasTranscript: boolean
  hasTranslation: boolean
  isTranslating: boolean
  error: string | null
  outputLanguage: string
  onTranslateFull: () => void
}

const LANG_LABELS: Record<string, string> = {
  KO: '한국어',
  'EN-US': '영어',
  JA: '일본어',
  ZH: '중국어',
  DE: '독일어',
  FR: '프랑스어',
}

export function TranslationPanel({
  hasTranscript,
  hasTranslation,
  isTranslating,
  error,
  outputLanguage,
  onTranslateFull,
}: TranslationPanelProps) {
  if (!hasTranscript) return null

  return (
    <div className="border-t border-zinc-800 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500 font-medium">번역</span>
        <span className="text-xs text-zinc-600">{LANG_LABELS[outputLanguage] ?? outputLanguage}</span>
      </div>

      {error && (
        <p className="text-xs text-red-400 bg-red-950/30 border border-red-900 rounded px-2 py-1.5">
          {error}
        </p>
      )}

      <button
        onClick={onTranslateFull}
        disabled={isTranslating}
        className="w-full flex items-center justify-center gap-2 border border-zinc-700 hover:border-zinc-500 text-zinc-300 hover:text-white text-sm rounded-lg py-2 transition-colors disabled:opacity-50"
      >
        {isTranslating ? (
          <>
            <Spinner size="sm" />
            번역 중...
          </>
        ) : (
          <>{hasTranslation ? '전체 재번역' : '전체 번역'}</>
        )}
      </button>

      <p className="text-xs text-zinc-600 text-center">
        또는 각 문장 위에 마우스를 올려 개별 번역
      </p>
    </div>
  )
}
