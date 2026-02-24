import { Chip } from '@mui/material'
import type { ProjectStatus } from '../../../../shared/types'

const STATUS_LABELS: Record<ProjectStatus, string> = {
  pending: '대기',
  processing: '처리 중',
  done: '완료',
  error: '오류',
}

const STATUS_COLORS: Record<ProjectStatus, 'default' | 'primary' | 'success' | 'error'> = {
  pending: 'default',
  processing: 'primary',
  done: 'success',
  error: 'error',
}

interface BadgeProps {
  status: ProjectStatus
}

export function Badge({ status }: BadgeProps) {
  return (
    <Chip
      label={STATUS_LABELS[status]}
      color={STATUS_COLORS[status]}
      size="small"
      sx={{ height: 20, fontSize: '0.7rem' }}
    />
  )
}
