// Byte length of a local file. Needed before a presign, because the size ceiling
// is enforced before a credential is minted rather than after an upload fails.
// SOT-KEYWORDS: file size native expo-file-system upload presign
import { File } from 'expo-file-system';

export const fileSize = async (uri: string): Promise<number> => new File(uri).size ?? 0;
