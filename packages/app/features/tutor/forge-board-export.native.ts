import { Directory } from 'expo-file-system';
import { createForgeBoardPngSaver } from './forge-board-export.shared';

/** Opens the system folder picker, writes the PNG, then verifies its bytes. */
export const saveForgeBoardPng = createForgeBoardPngSaver(() => Directory.pickDirectoryAsync());

export type { ForgeBoardPngSaveResult } from './forge-board-export.shared';
