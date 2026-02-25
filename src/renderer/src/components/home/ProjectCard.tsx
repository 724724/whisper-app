import { useNavigate } from 'react-router-dom'
import { Badge } from '../ui/Badge'
import type { Project } from '../../../../shared/types'

interface ProjectCardProps {
  project: Project
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function ProjectCard({ project, onDelete }: ProjectCardProps) {
  const navigate = useNavigate()

  const handleDoubleClick = () => {
    navigate(`/project/${project.id}`)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (confirm(`"${project.name}" 프로젝트를 삭제하시겠습니까?`)) {
      onDelete(project.id)
    }
  }

  return (
    <div
      onDoubleClick={handleDoubleClick}
      className="group bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-600 rounded-xl p-4 transition-all duration-150 cursor-pointer select-none"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg">{project.mediaType === 'video' ? '🎬' : '🎵'}</span>
            <span className="font-medium text-white truncate">{project.name}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge status={project.status} />
            {project.language && (
              <span className="text-xs text-zinc-500 uppercase">{project.language}</span>
            )}
            {project.modelUsed && (
              <span className="text-xs text-zinc-600">{project.modelUsed}</span>
            )}
          </div>
          <p className="text-xs text-zinc-600 mt-2">{formatDate(project.createdAt)}</p>
        </div>

        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-400 transition-all p-1 rounded"
          title="삭제"
        >
          ✕
        </button>
      </div>

      <p className="text-xs text-zinc-600 mt-3 text-right">더블클릭하여 열기</p>
    </div>
  )
}
