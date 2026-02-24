import { Box, LinearProgress, Typography } from '@mui/material'

interface ProgressBarProps {
  value: number
  label?: string
  className?: string
}

export function ProgressBar({ value, label }: ProgressBarProps) {
  return (
    <Box sx={{ width: '100%' }}>
      {label && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
          {label}
        </Typography>
      )}
      <LinearProgress variant="determinate" value={Math.min(100, Math.max(0, value))} sx={{ borderRadius: 1 }} />
    </Box>
  )
}
