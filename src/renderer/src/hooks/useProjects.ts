import { useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'

export function useProjects() {
  const { projects, isLoading, setProjects, addProject, updateProject, removeProject, setLoading } =
    useProjectStore()

  const loadProjects = useCallback(async () => {
    setLoading(true)
    try {
      const list = await window.api.listProjects()
      setProjects(list)
    } finally {
      setLoading(false)
    }
  }, [setProjects, setLoading])

  const importFile = useCallback(
    async (filePath: string, name?: string) => {
      const result = await window.api.importFile({ filePath, name })
      if (result.success && result.project) {
        addProject(result.project)
      }
      return result
    },
    [addProject]
  )

  const deleteProject = useCallback(
    async (projectId: string) => {
      const result = await window.api.deleteProject({ projectId })
      if (result.success) {
        removeProject(projectId)
      }
      return result
    },
    [removeProject]
  )

  const refreshProject = useCallback(
    async (projectId: string) => {
      const project = await window.api.getProject({ projectId })
      if (project) updateProject(project)
    },
    [updateProject]
  )

  return { projects, isLoading, loadProjects, importFile, deleteProject, refreshProject }
}
