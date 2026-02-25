import { app } from 'electron'
import { spawn, execSync, ChildProcess } from 'child_process'
import { join } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { mkdir, writeFile } from 'fs/promises'
import { createHash } from 'crypto'
import type { BackendStatus } from '../../shared/types'

const BACKEND_PORT = 18765
const BACKEND_HOST = '127.0.0.1'

function getVenvDir(): string {
  return join(app.getPath('userData'), 'python-env')
}

// Marker file — stores the requirements.txt MD5 hash of the last successful install
function getInstalledMarker(): string {
  return join(getVenvDir(), '.installed')
}

let serverProcess: ChildProcess | null = null
let onStatusUpdate: ((status: BackendStatus) => void) | null = null

export function setStatusCallback(cb: (status: BackendStatus) => void): void {
  onStatusUpdate = cb
}

function sendStatus(status: BackendStatus): void {
  onStatusUpdate?.(status)
}

function findPython(): string | null {
  const candidates = ['python3', 'python']
  for (const cmd of candidates) {
    try {
      const version = execSync(`${cmd} --version`, { encoding: 'utf8', timeout: 5000 }).trim()
      const match = version.match(/Python (\d+)\.(\d+)/)
      if (
        match &&
        (parseInt(match[1]) > 3 || (parseInt(match[1]) === 3 && parseInt(match[2]) >= 8))
      ) {
        return cmd
      }
    } catch {
      // not found, try next
    }
  }
  return null
}

function getPipPath(): string {
  if (process.platform === 'win32') {
    return join(getVenvDir(), 'Scripts', 'pip')
  }
  return join(getVenvDir(), 'bin', 'pip')
}

function getPythonPath(): string {
  if (process.platform === 'win32') {
    return join(getVenvDir(), 'Scripts', 'python')
  }
  return join(getVenvDir(), 'bin', 'python')
}

function getBackendDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'backend')
  }
  return join(app.getAppPath(), 'resources', 'backend')
}

function getRequirementsHash(): string {
  const requirementsPath = join(getBackendDir(), 'requirements.txt')
  try {
    const content = readFileSync(requirementsPath, 'utf8')
    return createHash('md5').update(content).digest('hex')
  } catch {
    return ''
  }
}

/**
 * Find LD_LIBRARY_PATH additions from pip-installed nvidia site-packages.
 * These provide libcublas.so.12, libcudart.so.12, libcudnn.so.* etc.
 * Layout: {venv}/lib/python3.x/site-packages/nvidia/{package}/lib/
 */
function getNvidiaSitePackageLibDirs(): string[] {
  const libDir = join(getVenvDir(), 'lib')
  if (!existsSync(libDir)) return []

  const dirs: string[] = []
  try {
    const pythonDirs = readdirSync(libDir).filter((d) => d.startsWith('python'))
    for (const pyDir of pythonDirs) {
      const nvidiaDir = join(libDir, pyDir, 'site-packages', 'nvidia')
      if (!existsSync(nvidiaDir)) continue
      const packages = readdirSync(nvidiaDir)
      for (const pkg of packages) {
        const libPath = join(nvidiaDir, pkg, 'lib')
        if (existsSync(libPath)) dirs.push(libPath)
      }
    }
  } catch {
    // ignore
  }
  return dirs
}

function runCommandStreaming(
  cmd: string,
  args: string[],
  onLine: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: 'pipe' })
    let stderrBuf = ''

    const processChunk = (chunk: Buffer): void => {
      chunk
        .toString()
        .split('\n')
        .forEach((line) => {
          const trimmed = line.trim()
          if (trimmed) onLine(trimmed)
        })
    }

    proc.stdout?.on('data', processChunk)
    proc.stderr?.on('data', (d: Buffer) => {
      stderrBuf += d.toString()
      processChunk(d)
    })

    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`Command failed (exit ${code}): ${stderrBuf.slice(-500)}`))
    })
    proc.on('error', reject)
  })
}

async function installDependencies(python: string): Promise<void> {
  const venvExists = existsSync(getPythonPath())
  const markerPath = getInstalledMarker()
  const currentHash = getRequirementsHash()

  // Check if already installed with the same requirements.txt content
  let alreadyInstalled = false
  if (existsSync(markerPath)) {
    try {
      const storedHash = readFileSync(markerPath, 'utf8').trim()
      alreadyInstalled = storedHash === currentHash
    } catch {
      // marker unreadable — treat as outdated
    }
  }

  if (!venvExists) {
    sendStatus({ phase: 'installing', message: '가상 환경 생성 중...', progress: 10 })
    await mkdir(getVenvDir(), { recursive: true })
    await runCommandStreaming(python, ['-m', 'venv', getVenvDir()], (line) => {
      console.log('[venv]', line)
    })
    alreadyInstalled = false // new venv always needs packages installed
  }

  if (alreadyInstalled) {
    sendStatus({ phase: 'installing', message: '패키지 확인 완료', progress: 90 })
    return
  }

  sendStatus({
    phase: 'installing',
    message: '패키지 설치 중 (첫 실행 시 5~10분 소요)...',
    progress: 30
  })

  const requirementsPath = join(getBackendDir(), 'requirements.txt')
  let progressValue = 30

  await runCommandStreaming(getPipPath(), ['install', '-r', requirementsPath], (line) => {
    console.log('[pip]', line)
    if (line.startsWith('Collecting')) {
      const pkg = line.replace('Collecting', '').split(/\s/)[1] ?? ''
      sendStatus({ phase: 'installing', message: `수집 중: ${pkg}`, progress: progressValue })
    } else if (line.startsWith('Downloading')) {
      const m = line.match(/Downloading (.+?) \(/)
      const name = m?.[1] ?? line.slice(0, 60)
      progressValue = Math.min(progressValue + 3, 80)
      sendStatus({ phase: 'installing', message: `다운로드: ${name}`, progress: progressValue })
    } else if (line.startsWith('Installing collected packages')) {
      sendStatus({ phase: 'installing', message: '패키지 설치 중...', progress: 85 })
    } else if (line.startsWith('Successfully installed')) {
      sendStatus({ phase: 'installing', message: '설치 완료!', progress: 90 })
    }
  })

  // Write current requirements hash as marker so subsequent starts skip pip
  await writeFile(markerPath, currentHash, 'utf8')
  sendStatus({ phase: 'installing', message: '패키지 설치 완료', progress: 90 })
}

async function isPortInUse(): Promise<boolean> {
  try {
    const res = await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/health`, {
      signal: AbortSignal.timeout(2000)
    })
    return res.ok
  } catch {
    // Could be in use but not our server, or nothing at all
    try {
      execSync(`fuser ${BACKEND_PORT}/tcp`, { stdio: 'ignore' })
      return true // port is in use by something else
    } catch {
      return false
    }
  }
}

function killPortProcess(): void {
  try {
    execSync(`fuser -k ${BACKEND_PORT}/tcp`, { stdio: 'ignore' })
  } catch {
    // no process on port, that's fine
  }
}

async function waitForServer(timeoutMs = 60000): Promise<void> {
  const start = Date.now()
  let attempt = 0
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://${BACKEND_HOST}:${BACKEND_PORT}/health`)
      if (res.ok) return
    } catch {
      attempt++
      const elapsed = Math.floor((Date.now() - start) / 1000)
      if (attempt % 6 === 0) {
        sendStatus({ phase: 'starting', message: `서버 시작 대기 중... (${elapsed}초 경과)` })
      }
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error('서버 시작 시간 초과 (60초)')
}

export async function startBackend(): Promise<void> {
  sendStatus({ phase: 'checking', message: 'Python 환경 확인 중...' })

  const python = findPython()
  if (!python) {
    sendStatus({
      phase: 'error',
      message: 'Python 3.8 이상이 필요합니다. Python을 설치하고 앱을 재시작하세요.'
    })
    return
  }

  try {
    await installDependencies(python)
  } catch (err) {
    sendStatus({ phase: 'error', message: `패키지 설치 실패: ${(err as Error).message}` })
    return
  }

  sendStatus({ phase: 'starting', message: 'FastAPI 서버 시작 중...' })

  // If port is already in use, check if it's our healthy server (reuse) or something else (kill it)
  if (await isPortInUse()) {
    sendStatus({ phase: 'ready', message: '준비 완료', progress: 100 })
    return
  }
  killPortProcess()
  await new Promise((r) => setTimeout(r, 500))

  // Build LD_LIBRARY_PATH to include pip-installed nvidia CUDA libs
  // (libcublas.so.12, libcudart.so.12, libcudnn.so.* etc.)
  const nvidiaDirs = getNvidiaSitePackageLibDirs()
  const existingLd = process.env['LD_LIBRARY_PATH'] ?? ''
  const newLd = [...nvidiaDirs, existingLd].filter(Boolean).join(':')
  if (nvidiaDirs.length > 0) {
    console.log('[backend] LD_LIBRARY_PATH nvidia dirs:', nvidiaDirs)
  }

  const backendDir = getBackendDir()
  serverProcess = spawn(
    getPythonPath(),
    [
      '-m',
      'uvicorn',
      'main:app',
      '--host',
      BACKEND_HOST,
      '--port',
      String(BACKEND_PORT),
      '--log-level',
      'info'
    ],
    {
      cwd: backendDir,
      env: { ...process.env, LD_LIBRARY_PATH: newLd },
      stdio: 'pipe'
    }
  )

  let stderrBuffer = ''

  serverProcess.stdout?.on('data', (d: Buffer) => {
    const msg = d.toString().trim()
    if (msg) console.log('[backend]', msg)
  })

  serverProcess.stderr?.on('data', (d: Buffer) => {
    const msg = d.toString().trim()
    if (!msg) return
    stderrBuffer += msg + '\n'
    console.error('[backend]', msg)
    if (msg.includes('Application startup complete')) {
      sendStatus({ phase: 'starting', message: '서버 초기화 완료, 연결 확인 중...' })
    } else if (msg.includes('Uvicorn running on')) {
      sendStatus({ phase: 'starting', message: '서버 실행 중, 준비 확인 중...' })
    }
  })

  serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      const detail = stderrBuffer.slice(-800).trim()
      const msg = detail
        ? `서버가 예기치 않게 종료되었습니다 (code: ${code})\n\n${detail}`
        : `서버가 예기치 않게 종료되었습니다 (code: ${code})`
      sendStatus({ phase: 'error', message: msg })
    }
  })

  try {
    await waitForServer()
  } catch (err) {
    sendStatus({ phase: 'error', message: `서버 시작 실패: ${(err as Error).message}` })
    stopBackend()
    return
  }

  sendStatus({ phase: 'ready', message: '준비 완료', progress: 100 })
}

export function stopBackend(): void {
  if (serverProcess) {
    const proc = serverProcess
    serverProcess = null
    proc.kill('SIGTERM')
    // Force kill if still alive after 3 seconds
    setTimeout(() => {
      try {
        proc.kill('SIGKILL')
      } catch {
        /* already dead */
      }
    }, 3000)
  }
  killPortProcess()
}

export const BACKEND_URL = `http://${BACKEND_HOST}:${BACKEND_PORT}`
