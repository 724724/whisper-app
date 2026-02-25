import { create } from 'zustand'
import type { BackendStatus } from '../../../shared/types'

interface BackendStore {
  status: BackendStatus
  isReady: boolean
  cudaAvailable: boolean
  gpuName: string | null
  logs: string[]
  usagePercent: number | null
  usageType: 'gpu' | 'cpu' | null
  setStatus: (status: BackendStatus) => void
  setHealthInfo: (info: { cudaAvailable: boolean; gpuName: string | null }) => void
  setUsage: (type: 'gpu' | 'cpu', percent: number | null) => void
}

export const useBackendStore = create<BackendStore>((set) => ({
  status: { phase: 'checking', message: '초기화 중...' },
  isReady: false,
  cudaAvailable: false,
  gpuName: null,
  logs: [],
  usagePercent: null,
  usageType: null,
  setStatus: (status) =>
    set((state) => ({
      status,
      isReady: status.phase === 'ready',
      // Keep last 20 log lines (exclude 'ready' which closes the screen)
      logs:
        status.phase !== 'ready'
          ? [...state.logs.slice(-19), `[${status.phase}] ${status.message}`]
          : state.logs
    })),
  setHealthInfo: (info) => set({ cudaAvailable: info.cudaAvailable, gpuName: info.gpuName }),
  setUsage: (type, percent) => set({ usageType: type, usagePercent: percent })
}))
