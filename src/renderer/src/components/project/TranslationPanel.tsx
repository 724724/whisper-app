import { Box, Button, Typography, Alert, CircularProgress, Divider } from '@mui/material'

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
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Divider />
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary" fontWeight="medium">번역</Typography>
        <Typography variant="caption" color="text.disabled">{LANG_LABELS[outputLanguage] ?? outputLanguage}</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ fontSize: '0.75rem', py: 0.5 }}>{error}</Alert>}

      <Button
        variant="outlined"
        size="small"
        fullWidth
        disabled={isTranslating}
        onClick={onTranslateFull}
        startIcon={isTranslating ? <CircularProgress size={12} /> : undefined}
      >
        {isTranslating ? '번역 중...' : (hasTranslation ? '전체 재번역' : '전체 번역')}
      </Button>

      <Typography variant="caption" color="text.disabled" align="center">
        또는 각 문장 위에 마우스를 올려 개별 번역
      </Typography>
    </Box>
  )
}
