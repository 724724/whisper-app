import { useState, useEffect } from 'react'
import { Modal } from '../ui/Modal'
import { useSettingsStore } from '../../store/settingsStore'
import type { AppSettings, WhisperModelName } from '../../../../shared/types'

const MODELS: { name: WhisperModelName; label: string; size: string }[] = [
  { name: 'tiny', label: 'Tiny', size: '75 MB' },
  { name: 'base', label: 'Base', size: '145 MB' },
  { name: 'small', label: 'Small', size: '466 MB' },
  { name: 'medium', label: 'Medium', size: '1.5 GB' },
  { name: 'large-v2', label: 'Large v2', size: '2.9 GB' },
  { name: 'large-v3', label: 'Large v3', size: '2.9 GB' },
]

const TARGET_LANGS = [
  { code: 'KO', label: '한국어' },
  { code: 'EN-US', label: '영어 (미국)' },
  { code: 'JA', label: '일본어' },
  { code: 'ZH', label: '중국어 (간체)' },
  { code: 'DE', label: '독일어' },
  { code: 'FR', label: '프랑스어' },
]

export function SettingsModal() {
  const { isOpen, closeSettings, settings, setSettings } = useSettingsStore()
  const [form, setForm] = useState<AppSettings>(settings)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setForm(settings)
  }, [settings, isOpen])

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const updated = await window.api.setSettings(form)
      setSettings(updated)
      closeSettings()
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={closeSettings} title="설정">
      <div className="flex flex-col gap-5">
        {/* DeepL API Key */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            DeepL API 키
          </label>
          <input
            type="password"
            value={form.deeplApiKey}
            onChange={(e) => setForm((f) => ({ ...f, deeplApiKey: e.target.value }))}
            placeholder="xxxx-xxxx-xxxx:fx"
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-blue-500"
          />
          <div className="flex gap-3 mt-2">
            {(['free', 'pro'] as const).map((type) => (
              <label key={type} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="apiType"
                  value={type}
                  checked={form.deeplApiType === type}
                  onChange={() => setForm((f) => ({ ...f, deeplApiType: type }))}
                  className="accent-blue-500"
                />
                <span className="text-sm text-zinc-300 capitalize">{type}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Whisper Model */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            Whisper 모델
          </label>
          <select
            value={form.whisperModel}
            onChange={(e) =>
              setForm((f) => ({ ...f, whisperModel: e.target.value as WhisperModelName }))
            }
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {MODELS.map((m) => (
              <option key={m.name} value={m.name}>
                {m.label} ({m.size})
              </option>
            ))}
          </select>
          <p className="text-xs text-zinc-500 mt-1">
            NVIDIA GPU 사용 시 large-v3 권장. 첫 사용 시 자동 다운로드됩니다.
          </p>
        </div>

        {/* Translation target language */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-1.5">
            번역 대상 언어
          </label>
          <select
            value={form.outputLanguage}
            onChange={(e) => setForm((f) => ({ ...f, outputLanguage: e.target.value }))}
            className="w-full bg-zinc-800 border border-zinc-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          >
            {TARGET_LANGS.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </div>

        {/* Theme */}
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            테마
          </label>
          <div className="grid grid-cols-3 gap-2">
            {([
              { value: 'dark', label: '다크', icon: '🌙' },
              { value: 'light', label: '라이트', icon: '☀️' },
              { value: 'system', label: '시스템', icon: '💻' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setForm((f) => ({ ...f, theme: opt.value }))}
                className={`flex flex-col items-center gap-1 py-2.5 rounded-lg border text-sm transition-colors ${
                  form.theme === opt.value
                    ? 'border-blue-500 bg-blue-950/40 text-blue-300'
                    : 'border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200'
                }`}
              >
                <span className="text-base">{opt.icon}</span>
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-600 mt-1.5">
            시스템: OS 설정에 따라 자동 전환
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium rounded-lg py-2.5 text-sm transition-colors"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>
      </div>
    </Modal>
  )
}
