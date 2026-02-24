import { ipcMain, dialog, app } from 'electron'
import { copyFile, mkdir, writeFile } from 'fs/promises'
import { join, basename, extname } from 'path'
import { nanoid } from 'nanoid'
import { store } from '../services/electronStore'
import type { Project, MediaType, TranscriptSegment } from '../../shared/types'

const VIDEO_EXTENSIONS = new Set(['.mp4', '.mkv', '.avi', '.mov', '.wmv', '.webm', '.flv', '.m4v'])

function getMediaType(filePath: string): MediaType {
  const ext = extname(filePath).toLowerCase()
  if (VIDEO_EXTENSIONS.has(ext)) return 'video'
  return 'audio'
}

function getMediaDir(): string {
  return join(app.getPath('userData'), 'media')
}

// ─── Export helpers ───────────────────────────────────────────────────────────

function msToSrtTime(ms: number): string {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const mill = ms % 1000
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(mill).padStart(3, '0')}`
}

function msToDisplayTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  return `${m}:${String(sec).padStart(2, '0')}`
}

function formatAsTxt(segments: TranscriptSegment[], hasTranslation: boolean): string {
  return segments
    .map((seg) => {
      const time = `[${msToDisplayTime(seg.startMs)} - ${msToDisplayTime(seg.endMs)}]`
      if (hasTranslation && seg.translatedText) {
        return `${time}\n${seg.text}\n${seg.translatedText}`
      }
      return `${time} ${seg.text}`
    })
    .join('\n\n')
}

function formatAsSrt(segments: TranscriptSegment[], hasTranslation: boolean): string {
  return segments
    .map((seg, i) => {
      const lines = [
        String(i + 1),
        `${msToSrtTime(seg.startMs)} --> ${msToSrtTime(seg.endMs)}`,
        seg.text,
      ]
      if (hasTranslation && seg.translatedText) lines.push(seg.translatedText)
      return lines.join('\n')
    })
    .join('\n\n')
}

function formatAsCsv(segments: TranscriptSegment[], hasTranslation: boolean): string {
  const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = hasTranslation
    ? 'start_ms,end_ms,start_time,end_time,text,translated_text'
    : 'start_ms,end_ms,start_time,end_time,text'

  const rows = segments.map((seg) => {
    const cols = [
      seg.startMs,
      seg.endMs,
      escapeCsv(msToDisplayTime(seg.startMs)),
      escapeCsv(msToDisplayTime(seg.endMs)),
      escapeCsv(seg.text),
    ]
    if (hasTranslation) cols.push(escapeCsv(seg.translatedText ?? ''))
    return cols.join(',')
  })

  return [header, ...rows].join('\n')
}

// ─── Handlers ─────────────────────────────────────────────────────────────────

export function registerFileHandlers(): void {
  ipcMain.handle('file:open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: '미디어 파일', extensions: ['mp3', 'wav', 'm4a', 'flac', 'ogg', 'aac', 'mp4', 'mkv', 'avi', 'mov', 'wmv', 'webm', 'opus'] },
      ],
    })
    return { canceled: result.canceled, filePaths: result.filePaths }
  })

  ipcMain.handle('file:import', async (_event, { filePath, name }: { filePath: string; name?: string }) => {
    try {
      const mediaDir = getMediaDir()
      await mkdir(mediaDir, { recursive: true })

      const id = nanoid()
      const originalFileName = basename(filePath)
      const ext = extname(originalFileName)
      const storedFileName = `${id}${ext}`
      const storedFilePath = join(mediaDir, storedFileName)

      await copyFile(filePath, storedFilePath)

      const project: Project = {
        id,
        name: name || originalFileName.replace(ext, ''),
        originalFileName,
        mediaType: getMediaType(filePath),
        storedFilePath,
        status: 'pending',
        modelUsed: null,
        language: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        transcriptId: null,
        durationSeconds: null,
      }

      const projects = store.get('projects')
      store.set('projects', [project, ...projects])

      return { success: true, project }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  ipcMain.handle('file:get-media-url', (_event, { storedFilePath }: { storedFilePath: string }) => {
    // Encode each path segment individually to preserve '/' separators
    const urlPath = storedFilePath.split('/').map(encodeURIComponent).join('/')
    return { url: `media://localhost${urlPath}` }
  })

  ipcMain.handle(
    'file:export-transcript',
    async (
      _event,
      {
        segments,
        projectName,
        format,
        hasTranslation,
      }: {
        segments: TranscriptSegment[]
        projectName: string
        format: 'txt' | 'srt' | 'csv'
        hasTranslation: boolean
      }
    ) => {
      const filterMap = {
        txt: { name: '텍스트 파일', extensions: ['txt'] },
        srt: { name: 'SRT 자막 파일', extensions: ['srt'] },
        csv: { name: 'CSV 파일', extensions: ['csv'] },
      }

      const result = await dialog.showSaveDialog({
        defaultPath: `${projectName}.${format}`,
        filters: [filterMap[format]],
      })

      if (result.canceled || !result.filePath) return { success: false }

      let content: string
      if (format === 'srt') {
        content = formatAsSrt(segments, hasTranslation)
      } else if (format === 'csv') {
        content = formatAsCsv(segments, hasTranslation)
      } else {
        content = formatAsTxt(segments, hasTranslation)
      }

      await writeFile(result.filePath, content, 'utf8')
      return { success: true, path: result.filePath }
    }
  )
}
