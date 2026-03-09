import { useState, useCallback } from 'react'
import { Typography, Paper } from '@mui/material'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import { useProjects } from '../../hooks/useProjects'

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const { importFile } = useProjects()

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        const filePath = window.electron.webUtils.getPathForFile(file)
        if (filePath) await importFile(filePath)
      }
    },
    [importFile]
  )

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }
  const onDragLeave = () => setIsDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    handleFiles(Array.from(e.dataTransfer.files))
  }
  const onBrowse = async () => {
    const result = await window.api.openFileDialog()
    if (!result.canceled && result.filePaths.length > 0) {
      for (const p of result.filePaths) await importFile(p)
    }
  }

  return (
    <Paper
      variant="outlined"
      onClick={onBrowse}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      sx={{
        p: 4,
        textAlign: 'center',
        cursor: 'pointer',
        borderStyle: 'dashed',
        borderWidth: 2,
        transition: 'all 0.2s',
        bgcolor: isDragging ? 'action.selected' : 'background.paper',
        borderColor: isDragging ? 'primary.main' : 'divider',
        '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' }
      }}
    >
      <MusicNoteIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
      <Typography variant="body1" fontWeight="medium" gutterBottom>
        파일을 여기에 드래그하거나 클릭하여 가져오기
      </Typography>
      <Typography variant="body2" color="text.secondary">
        MP3, WAV, MP4, MKV, MOV 등 지원
      </Typography>
    </Paper>
  )
}
