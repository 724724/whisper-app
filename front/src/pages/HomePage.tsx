import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import MovieIcon from '@mui/icons-material/Movie'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import MicIcon from '@mui/icons-material/Mic'
import FolderIcon from '@mui/icons-material/Folder'
import FolderOpenIcon from '@mui/icons-material/FolderOpen'
import CreateNewFolderIcon from '@mui/icons-material/CreateNewFolder'
import DriveFileMoveIcon from '@mui/icons-material/DriveFileMove'
import CloseIcon from '@mui/icons-material/Close'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { DropZone } from '../components/home/DropZone'
import { Badge } from '../components/ui/Badge'
import { useProjects } from '../hooks/useProjects'
import type { ProjectFolder } from '@shared/types'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function HomePage() {
  const navigate = useNavigate()
  const { projects, isLoading, loadProjects, deleteProject, moveToFolder } = useProjects()

  // ── Folder state ────────────────────────────────────────────────────────
  const [folders, setFolders] = useState<ProjectFolder[]>([])
  const [activeFolderId, setActiveFolderId] = useState<string | 'all'>('all')
  const [showNewFolderInput, setShowNewFolderInput] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [renamingFolder, setRenamingFolder] = useState<{ id: string; name: string } | null>(null)
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'all' | null>(null)

  // ── Multi-select state ───────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Move menu state ──────────────────────────────────────────────────────
  const [moveMenuAnchor, setMoveMenuAnchor] = useState<HTMLElement | null>(null)

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  const draggedIdsRef = useRef<string[]>([])
  const lastSelectedIdxRef = useRef<number>(-1)

  const loadFolders = useCallback(async () => {
    const list = await window.api.listFolders()
    setFolders(list)
  }, [])

  useEffect(() => {
    loadProjects()
    loadFolders()
  }, [loadProjects, loadFolders])

  const handleSetActiveFolder = (id: string | 'all') => {
    setActiveFolderId(id)
    setSelectedIds(new Set())
    lastSelectedIdxRef.current = -1
  }

  const displayedProjects =
    activeFolderId === 'all'
      ? projects
      : projects.filter((p) => p.folderId === activeFolderId)

  // ── Folder CRUD ──────────────────────────────────────────────────────────
  const handleCreateFolder = async () => {
    const name = newFolderName.trim()
    if (!name) return
    const folder = await window.api.createFolder({ name })
    setFolders((prev) => [...prev, folder])
    setNewFolderName('')
    setShowNewFolderInput(false)
  }

  const handleRenameFolder = async () => {
    if (!renamingFolder || !renamingFolder.name.trim()) {
      setRenamingFolder(null)
      return
    }
    await window.api.renameFolder({ folderId: renamingFolder.id, name: renamingFolder.name.trim() })
    setFolders((prev) =>
      prev.map((f) =>
        f.id === renamingFolder.id ? { ...f, name: renamingFolder.name.trim() } : f
      )
    )
    setRenamingFolder(null)
  }

  const handleDeleteFolder = async (folderId: string, name: string) => {
    if (
      !confirm(
        `"${name}" 폴더를 삭제하시겠습니까?\n폴더 안의 프로젝트는 삭제되지 않고 전체 목록으로 이동됩니다.`
      )
    )
      return
    await window.api.deleteFolder({ folderId })
    setFolders((prev) => prev.filter((f) => f.id !== folderId))
    if (activeFolderId === folderId) setActiveFolderId('all')
    await loadProjects()
  }

  // ── Selection ────────────────────────────────────────────────────────────
  const toggleSelect = (id: string, idx?: number) => {
    if (idx !== undefined) lastSelectedIdxRef.current = idx
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleRangeSelect = (toIdx: number) => {
    const fromIdx = lastSelectedIdxRef.current
    if (fromIdx < 0) {
      const id = displayedProjects[toIdx]?.id
      if (id) toggleSelect(id, toIdx)
      return
    }
    const start = Math.min(fromIdx, toIdx)
    const end = Math.max(fromIdx, toIdx)
    const idsToAdd = displayedProjects.slice(start, end + 1).map((p) => p.id)
    setSelectedIds((prev) => new Set([...prev, ...idsToAdd]))
    lastSelectedIdxRef.current = toIdx
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedProjects.length && displayedProjects.length > 0) {
      setSelectedIds(new Set())
      lastSelectedIdxRef.current = -1
    } else {
      setSelectedIds(new Set(displayedProjects.map((p) => p.id)))
    }
  }

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    const ids = selectedIds.has(projectId) ? [...selectedIds] : [projectId]
    draggedIdsRef.current = ids
    e.dataTransfer.effectAllowed = 'move'

    // Custom drag image — small pill so the default ghost doesn't look broken
    const ghost = document.createElement('div')
    ghost.textContent = ids.length > 1 ? `${ids.length}개 이동` : '프로젝트 이동'
    ghost.style.cssText =
      'position:fixed;top:-1000px;left:-1000px;' +
      'background:#1976d2;color:#fff;padding:5px 14px;' +
      'border-radius:20px;font-size:13px;font-weight:600;white-space:nowrap;'
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, ghost.offsetWidth / 2, 16)
    setTimeout(() => document.body.removeChild(ghost), 0)
  }

  const handleFolderDragOver = (e: React.DragEvent, id: string | 'all') => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverFolderId(id)
  }

  const handleFolderDragLeave = () => {
    setDragOverFolderId(null)
  }

  const handleFolderDrop = async (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    setDragOverFolderId(null)
    const ids = draggedIdsRef.current
    if (ids.length === 0) return
    await moveToFolder(ids, folderId)
    setSelectedIds(new Set())
  }

  // ── Bulk actions ─────────────────────────────────────────────────────────
  const handleBulkMove = async (folderId: string | null) => {
    await moveToFolder([...selectedIds], folderId)
    setMoveMenuAnchor(null)
    setSelectedIds(new Set())
  }

  const handleBulkDelete = async () => {
    if (!confirm(`${selectedIds.size}개의 프로젝트를 삭제하시겠습니까?`)) return
    for (const id of selectedIds) {
      await deleteProject(id)
    }
    setSelectedIds(new Set())
  }

  const handleSingleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`"${name}" 프로젝트를 삭제하시겠습니까?`)) {
      await deleteProject(id)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  const hasSelection = selectedIds.size > 0

  return (
    <Box
      sx={{
        height: '100%',
        overflowY: 'auto',
        p: 3,
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      <DropZone />

      {/* Real-time transcription entry */}
      <Button
        variant="outlined"
        startIcon={<MicIcon />}
        onClick={() => navigate('/realtime')}
        fullWidth
        sx={{ borderStyle: 'dashed', py: 1.2 }}
      >
        실시간 전사
      </Button>

      <Divider />

      {/* ── Folder chips row ───────────────────────────────────────────────── */}
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* "전체" chip — drop here to remove from any folder */}
        <Chip
          label="전체"
          icon={<FolderOpenIcon />}
          onClick={() => handleSetActiveFolder('all')}
          color={activeFolderId === 'all' ? 'primary' : 'default'}
          variant={activeFolderId === 'all' ? 'filled' : 'outlined'}
          onDragOver={(e) => handleFolderDragOver(e, 'all')}
          onDragLeave={handleFolderDragLeave}
          onDrop={(e) => handleFolderDrop(e, null)}
          sx={{
            transition: 'transform 0.12s',
            ...(dragOverFolderId === 'all' && {
              outline: '2px solid',
              outlineColor: 'primary.main',
              transform: 'scale(1.06)'
            })
          }}
        />

        {/* Per-folder chips */}
        {folders.map((folder) =>
          renamingFolder?.id === folder.id ? (
            <TextField
              key={folder.id}
              size="small"
              value={renamingFolder.name}
              onChange={(e) => setRenamingFolder({ ...renamingFolder, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameFolder()
                if (e.key === 'Escape') setRenamingFolder(null)
              }}
              onBlur={handleRenameFolder}
              autoFocus
              sx={{ width: 130 }}
              inputProps={{ style: { padding: '4px 8px', fontSize: '0.8125rem' } }}
            />
          ) : (
            <Chip
              key={folder.id}
              label={folder.name}
              icon={<FolderIcon />}
              onClick={() => handleSetActiveFolder(folder.id)}
              onDoubleClick={() => setRenamingFolder({ id: folder.id, name: folder.name })}
              color={activeFolderId === folder.id ? 'primary' : 'default'}
              variant={activeFolderId === folder.id ? 'filled' : 'outlined'}
              onDelete={() => handleDeleteFolder(folder.id, folder.name)}
              deleteIcon={
                <Tooltip title="폴더 삭제">
                  <CloseIcon />
                </Tooltip>
              }
              onDragOver={(e) => handleFolderDragOver(e, folder.id)}
              onDragLeave={handleFolderDragLeave}
              onDrop={(e) => handleFolderDrop(e, folder.id)}
              sx={{
                transition: 'transform 0.12s',
                ...(dragOverFolderId === folder.id && {
                  outline: '2px solid',
                  outlineColor: 'primary.main',
                  transform: 'scale(1.06)'
                })
              }}
            />
          )
        )}

        {/* New folder input or "+ 새 폴더" chip */}
        {showNewFolderInput ? (
          <TextField
            size="small"
            placeholder="폴더 이름"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder()
              if (e.key === 'Escape') {
                setShowNewFolderInput(false)
                setNewFolderName('')
              }
            }}
            onBlur={() => {
              if (!newFolderName.trim()) {
                setShowNewFolderInput(false)
                setNewFolderName('')
              }
            }}
            autoFocus
            sx={{ width: 150 }}
            inputProps={{ style: { padding: '4px 8px', fontSize: '0.8125rem' } }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={handleCreateFolder} edge="end">
                    <CreateNewFolderIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              )
            }}
          />
        ) : (
          <Chip
            label="+ 새 폴더"
            variant="outlined"
            size="small"
            onClick={() => setShowNewFolderInput(true)}
            sx={{ borderStyle: 'dashed', color: 'text.secondary' }}
          />
        )}
      </Box>

      {/* ── Project section header / bulk toolbar ─────────────────────────── */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minHeight: 32 }}>
        {hasSelection && (
          <Checkbox
            size="small"
            checked={displayedProjects.length > 0 && selectedIds.size === displayedProjects.length}
            indeterminate={selectedIds.size > 0 && selectedIds.size < displayedProjects.length}
            onChange={toggleSelectAll}
            sx={{ p: 0.25 }}
          />
        )}

        {hasSelection ? (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
              {selectedIds.size}개 선택됨
            </Typography>
            <Tooltip title="폴더로 이동">
              <IconButton size="small" onClick={(e) => setMoveMenuAnchor(e.currentTarget)}>
                <DriveFileMoveIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="선택 항목 삭제">
              <IconButton size="small" color="error" onClick={handleBulkDelete}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="선택 해제">
              <IconButton size="small" onClick={() => { setSelectedIds(new Set()); lastSelectedIdxRef.current = -1 }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </>
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
            프로젝트{displayedProjects.length > 0 ? ` (${displayedProjects.length})` : ''}
          </Typography>
        )}
      </Box>

      {/* ── Move-to-folder Menu ────────────────────────────────────────────── */}
      <Menu
        anchorEl={moveMenuAnchor}
        open={Boolean(moveMenuAnchor)}
        onClose={() => setMoveMenuAnchor(null)}
      >
        <MenuItem dense onClick={() => handleBulkMove(null)}>
          <ListItemIcon>
            <FolderOpenIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>폴더 없음</ListItemText>
        </MenuItem>
        {folders.map((f) => (
          <MenuItem dense key={f.id} onClick={() => handleBulkMove(f.id)}>
            <ListItemIcon>
              <FolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>{f.name}</ListItemText>
          </MenuItem>
        ))}
      </Menu>

      {/* ── Project list ───────────────────────────────────────────────────── */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : displayedProjects.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 6 }}>
          {activeFolderId === 'all'
            ? '파일을 가져오면 여기에 표시됩니다'
            : '이 폴더에 프로젝트가 없습니다'}
        </Typography>
      ) : (
        <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          {displayedProjects.map((project, index) => {
            const folderName =
              activeFolderId === 'all' && project.folderId
                ? folders.find((f) => f.id === project.folderId)?.name
                : undefined

            return (
              <ListItem
                key={project.id}
                disablePadding
                draggable
                onDragStart={(e) => handleDragStart(e, project.id)}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Tooltip title="열기">
                      <IconButton
                        size="small"
                        onClick={(e) => { e.stopPropagation(); navigate(`/project/${project.id}`) }}
                      >
                        <ChevronRightIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="삭제">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => handleSingleDelete(e, project.id, project.name)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
                sx={{
                  bgcolor: 'background.paper',
                  border: 1,
                  borderColor: selectedIds.has(project.id) ? 'primary.main' : 'divider',
                  borderRadius: 1,
                  cursor: 'grab',
                  '&:hover': { borderColor: 'primary.main' },
                  '&:active': { cursor: 'grabbing' }
                }}
              >
                {hasSelection && (
                  <Checkbox
                    size="small"
                    checked={selectedIds.has(project.id)}
                    onChange={() => toggleSelect(project.id, index)}
                    onClick={(e) => e.stopPropagation()}
                    sx={{ ml: 0.5, flexShrink: 0 }}
                  />
                )}
                <ListItemButton
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      e.shiftKey ? handleRangeSelect(index) : toggleSelect(project.id, index)
                    } else {
                      navigate(`/project/${project.id}`)
                    }
                  }}
                  sx={{ py: 1.5, pr: 10 }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {project.mediaType === 'video' ? (
                      <MovieIcon fontSize="small" color="action" />
                    ) : (
                      <MusicNoteIcon fontSize="small" color="action" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box
                        sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}
                      >
                        <Typography
                          variant="body2"
                          fontWeight="medium"
                          noWrap
                          sx={{ maxWidth: 220 }}
                        >
                          {project.name}
                        </Typography>
                        <Badge status={project.status} />
                        {folderName && (
                          <Chip
                            label={folderName}
                            size="small"
                            icon={<FolderIcon style={{ fontSize: 11 }} />}
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                        {project.language && (
                          <Chip
                            label={project.language.toUpperCase()}
                            size="small"
                            variant="outlined"
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        )}
                        {project.modelUsed && (
                          <Typography variant="caption" color="text.disabled">
                            {project.modelUsed}
                          </Typography>
                        )}
                      </Box>
                    }
                    secondary={formatDate(project.createdAt)}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            )
          })}
        </List>
      )}
    </Box>
  )
}
