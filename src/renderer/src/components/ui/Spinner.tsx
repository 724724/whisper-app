import { CircularProgress } from '@mui/material'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_PX = { sm: 16, md: 24, lg: 40 }

export function Spinner({ size = 'md' }: SpinnerProps) {
  return <CircularProgress size={SIZE_PX[size]} />
}
