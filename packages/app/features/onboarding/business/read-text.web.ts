import type { ReadText } from './read-text.types.ts';

/**
 * The picker hands back an object URL, which `fetch` reads without a second
 * dependency. Revoked afterwards — a roster file held for the session is a leak
 * with the whole CSV still in it.
 */
export const readText: ReadText = async (uri) => {
  const response = await fetch(uri);
  const text = await response.text();
  if (uri.startsWith('blob:')) URL.revokeObjectURL(uri);
  return text;
};
