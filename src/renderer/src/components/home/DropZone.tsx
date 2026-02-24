import { useState, useCallback } from 'react'
import { useProjects } from '../../hooks/useProjects'

export function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const { importFile } = useProjects()

  const handleFiles = useCallback(
    async (files: File[]) => {
      for (const file of files) {
        // Electron 32+: file.path is removed, use webUtils.getPathForFile instead
        const filePath = window.electron.webUtils.getPathForFile(file)
        if (filePath) {
          await importFile(filePath)
        }
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
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const onBrowse = async () => {
    const result = await window.api.openFileDialog()
    if (!result.canceled && result.filePaths.length > 0) {
      for (const p of result.filePaths) {
        await importFile(p)
      }
    }
  }

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`
        border-2 border-dashed rounded-xl p-10 text-center transition-all duration-200 cursor-pointer
        ${isDragging
          ? 'border-blue-400 bg-blue-950/30'
          : 'border-zinc-700 hover:border-zinc-500 hover:bg-zinc-900/50'
        }
      `}
      onClick={onBrowse}
    >
      <div className="text-4xl mb-3 select-none">🎵</div>
      <p className="text-white font-medium mb-1">파일을 여기에 드래그하거나 클릭하여 가져오기</p>
      <p className="text-zinc-500 text-sm">
        MP3, WAV, MP4, MKV, MOV 등 지원
      </p>
    </div>
  )
}
