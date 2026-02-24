import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Typography, List, ListItem, ListItemButton, ListItemText,
  ListItemIcon, IconButton, Chip, CircularProgress,
} from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import OpenInNewIcon from '@mui/icons-material/OpenInNew'
import MovieIcon from '@mui/icons-material/Movie'
import MusicNoteIcon from '@mui/icons-material/MusicNote'
import { DropZone } from '../components/home/DropZone'
import { Badge } from '../components/ui/Badge'
import { useProjects } from '../hooks/useProjects'

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

export function HomePage() {
  const navigate = useNavigate()
  const { projects, isLoading, loadProjects, deleteProject } = useProjects()
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => { loadProjects() }, [loadProjects])

  const handleDelete = async (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation()
    if (confirm(`"${name}" 프로젝트를 삭제하시겠습니까?`)) await deleteProject(id)
  }

  return (
    <Box sx={{ height: '100%', overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 3 }}>
      <DropZone />

      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          프로젝트 {projects.length > 0 && `(${projects.length})`}
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        ) : projects.length === 0 ? (
          <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', py: 6 }}>
            파일을 가져오면 여기에 표시됩니다
          </Typography>
        ) : (
          <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {projects.map((project) => (
              <ListItem
                key={project.id}
                disablePadding
                onMouseEnter={() => setHoveredId(project.id)}
                onMouseLeave={() => setHoveredId(null)}
                secondaryAction={
                  hoveredId === project.id ? (
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                      <IconButton size="small" onClick={() => navigate(`/project/${project.id}`)} title="열기">
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={(e) => handleDelete(e, project.id, project.name)} title="삭제">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : null
                }
                sx={{ bgcolor: 'background.paper', border: 1, borderColor: 'divider', borderRadius: 1, '&:hover': { borderColor: 'primary.main' } }}
              >
                <ListItemButton onDoubleClick={() => navigate(`/project/${project.id}`)} sx={{ py: 1.5 }}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {project.mediaType === 'video'
                      ? <MovieIcon fontSize="small" color="action" />
                      : <MusicNoteIcon fontSize="small" color="action" />
                    }
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                        <Typography variant="body2" fontWeight="medium" noWrap sx={{ maxWidth: 260 }}>
                          {project.name}
                        </Typography>
                        <Badge status={project.status} />
                        {project.language && (
                          <Chip label={project.language.toUpperCase()} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                        )}
                        {project.modelUsed && (
                          <Typography variant="caption" color="text.disabled">{project.modelUsed}</Typography>
                        )}
                      </Box>
                    }
                    secondary={formatDate(project.createdAt)}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </Box>
  )
}
