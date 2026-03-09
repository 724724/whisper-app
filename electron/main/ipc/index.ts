import { registerFileHandlers } from './fileHandlers'
import { registerProjectHandlers } from './projectHandlers'
import { registerTranscriptHandlers } from './transcriptHandlers'
import { registerTranslateHandlers } from './translateHandlers'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerFolderHandlers } from './folderHandlers'

export function registerAllHandlers(): void {
  registerFileHandlers()
  registerProjectHandlers()
  registerTranscriptHandlers()
  registerTranslateHandlers()
  registerSettingsHandlers()
  registerFolderHandlers()
}
