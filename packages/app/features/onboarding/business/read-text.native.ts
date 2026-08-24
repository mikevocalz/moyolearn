import { File } from 'expo-file-system';
import type { ReadText } from './read-text.types.ts';

/**
 * expo-file-system, which the app already carries for the picker — RN's `fetch`
 * does not read `file://` reliably, so this is not the same call as the web fork.
 */
export const readText: ReadText = (uri) => new File(uri).text();
