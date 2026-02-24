import { registerFileHandlers } from './fileHandlers'
import { registerProjectHandlers } from './projectHandlers'
import { registerTranscriptHandlers } from './transcriptHandlers'
import { registerTranslateHandlers } from './translateHandlers'
import { registerSettingsHandlers } from './settingsHandlers'

export function registerAllHandlers(): void {
  registerFileHandlers()
  registerProjectHandlers()
  registerTranscriptHandlers()
  registerTranslateHandlers()
  registerSettingsHandlers()
}
