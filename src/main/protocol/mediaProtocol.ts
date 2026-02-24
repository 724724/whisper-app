import { protocol } from 'electron'
import { statSync, createReadStream } from 'fs'

const MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  opus: 'audio/ogg; codecs=opus',
  mp4: 'video/mp4',
  mkv: 'video/x-matroska',
  avi: 'video/x-msvideo',
  mov: 'video/quicktime',
  wmv: 'video/x-ms-wmv',
  webm: 'video/webm',
  m4v: 'video/mp4',
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

function nodeStreamToWebStream(
  nodeStream: ReturnType<typeof createReadStream>
): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => {
        controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      })
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
    cancel() {
      nodeStream.destroy()
    },
  })
}

// Call inside app.whenReady() — uses protocol.handle (Electron 30+)
export function handleMediaProtocol(): void {
  protocol.handle('media', async (request) => {
    const url = new URL(request.url)
    const filePath = decodeURIComponent(url.pathname)

    let fileSize: number
    try {
      fileSize = statSync(filePath).size
    } catch {
      return new Response('File not found', { status: 404 })
    }

    const mimeType = getMimeType(filePath)
    const rangeHeader = request.headers.get('Range')

    if (rangeHeader) {
      const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
      if (match) {
        const start = parseInt(match[1])
        const end = match[2] ? parseInt(match[2]) : fileSize - 1
        const chunkSize = end - start + 1

        return new Response(
          nodeStreamToWebStream(createReadStream(filePath, { start, end })),
          {
            status: 206,
            headers: {
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes',
              'Content-Length': String(chunkSize),
              'Content-Type': mimeType,
            },
          }
        )
      }
    }

    // Full file request — include Content-Length so <audio>/<video> can determine duration
    return new Response(
      nodeStreamToWebStream(createReadStream(filePath)),
      {
        status: 200,
        headers: {
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes',
          'Content-Type': mimeType,
        },
      }
    )
  })
}
