import { useEffect } from 'react'
import { useBackendStore } from '../store/backendStore'

const BACKEND_URL = 'http://127.0.0.1:18765'

export function useBackendInit(): void {
  const setStatus = useBackendStore((s) => s.setStatus)
  const setHealthInfo = useBackendStore((s) => s.setHealthInfo)
  const setUsage = useBackendStore((s) => s.setUsage)
  const isReady = useBackendStore((s) => s.isReady)

  useEffect(() => {
    // Subscribe to IPC backend status events
    const unsubscribe = window.api.onBackendStatus(async (status) => {
      setStatus(status)
      if (status.phase === 'ready') {
        // Fetch health info to get CUDA availability
        try {
          const res = await fetch(`${BACKEND_URL}/health`)
          if (res.ok) {
            const data = await res.json()
            setHealthInfo({ cudaAvailable: data.cuda_available, gpuName: data.gpu_name })
          }
        } catch {
          // ignore
        }
      }
    })
    return unsubscribe
  }, [setStatus, setHealthInfo])

  // Poll /usage every 2 seconds once backend is ready
  useEffect(() => {
    if (!isReady) return
    const poll = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/usage`)
        if (res.ok) {
          const { type, percent } = (await res.json()) as { type: 'gpu' | 'cpu'; percent: number | null }
          setUsage(type, percent)
        }
      } catch {
        // ignore
      }
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => clearInterval(id)
  }, [isReady, setUsage])
}

export function backendFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${BACKEND_URL}${path}`, init)
}

export { BACKEND_URL }
