import { useEffect } from 'react'
import { useSettingsStore } from '../store/settingsStore'

export function useTheme() {
  const theme = useSettingsStore((s) => s.settings.theme)

  useEffect(() => {
    const root = document.documentElement
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')

    function apply(isDark: boolean) {
      if (isDark) {
        root.classList.add('dark')
        root.classList.remove('light')
      } else {
        root.classList.remove('dark')
        root.classList.add('light')
      }
    }

    if (theme === 'dark') {
      apply(true)
      return
    }

    if (theme === 'light') {
      apply(false)
      return
    }

    // 'system' — follow OS preference
    apply(mediaQuery.matches)
    const listener = (e: MediaQueryListEvent) => apply(e.matches)
    mediaQuery.addEventListener('change', listener)
    return () => mediaQuery.removeEventListener('change', listener)
  }, [theme])
}
