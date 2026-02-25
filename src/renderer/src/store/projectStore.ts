import { create } from 'zustand'
import type { Project } from '../../../shared/types'

interface ProjectStore {
  projects: Project[]
  isLoading: boolean
  setProjects: (projects: Project[]) => void
  addProject: (project: Project) => void
  updateProject: (updated: Project) => void
  removeProject: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useProjectStore = create<ProjectStore>((set) => ({
  projects: [],
  isLoading: false,
  setProjects: (projects) => set({ projects }),
  addProject: (project) => set((s) => ({ projects: [project, ...s.projects] })),
  updateProject: (updated) =>
    set((s) => ({
      projects: s.projects.map((p) => (p.id === updated.id ? updated : p))
    })),
  removeProject: (id) => set((s) => ({ projects: s.projects.filter((p) => p.id !== id) })),
  setLoading: (loading) => set({ isLoading: loading })
}))
