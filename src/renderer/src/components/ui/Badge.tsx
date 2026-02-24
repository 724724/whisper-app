import type { ProjectStatus } from '../../../../shared/types'

const STATUS_STYLES: Record<ProjectStatus, string> = {
  pending: 'bg-zinc-700 text-zinc-300',
  processing: 'bg-blue-900 text-blue-300 animate-pulse',
  done: 'bg-emerald-900 text-emerald-300',
  error: 'bg-red-900 text-red-300',
}

const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: '대기',
  processing: '처리 중',
  done: '완료',
  error: '오류',
}

interface BadgeProps {
  status: ProjectStatus
}

export function Badge({ status }: BadgeProps) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
