import { useEffect } from 'react'
import { DropZone } from '../components/home/DropZone'
import { useProjects } from '../hooks/useProjects'
import { Badge } from '../components/ui/Badge'
import { useNavigate } from 'react-router-dom'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function HomePage() {
  const navigate = useNavigate()
  const { projects, isLoading, loadProjects, deleteProject } = useProjects()

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`"${name}" 프로젝트를 삭제하시겠습니까?`)) {
      await deleteProject(id)
    }
  }

  return (
    <div className="h-full overflow-y-auto px-6 py-5 space-y-6">
      <DropZone />

      {/* Project list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-medium text-zinc-400">
            프로젝트 {projects.length > 0 && `(${projects.length})`}
          </h2>
        </div>

        {isLoading ? (
          <div className="text-zinc-600 text-sm text-center py-8">불러오는 중...</div>
        ) : projects.length === 0 ? (
          <div className="text-zinc-600 text-sm text-center py-12">
            파일을 가져오면 여기에 표시됩니다
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {projects.map((project) => (
              <div
                key={project.id}
                onDoubleClick={() => navigate(`/project/${project.id}`)}
                className="group bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-all duration-150 cursor-pointer select-none"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xl shrink-0">
                      {project.mediaType === 'video' ? '🎬' : '🎵'}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate">{project.name}</p>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <Badge status={project.status} />
                        {project.language && (
                          <span className="text-xs text-zinc-500 uppercase">{project.language}</span>
                        )}
                        {project.modelUsed && (
                          <span className="text-xs text-zinc-600">{project.modelUsed}</span>
                        )}
                        <span className="text-xs text-zinc-700">{formatDate(project.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => navigate(`/project/${project.id}`)}
                      className="opacity-0 group-hover:opacity-100 text-xs text-zinc-400 hover:text-white border border-zinc-700 hover:border-zinc-500 px-2.5 py-1 rounded-lg transition-all"
                    >
                      열기
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.name) }}
                      className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1 rounded text-sm"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
