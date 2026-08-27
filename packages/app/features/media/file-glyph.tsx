'use client';
// Type-specific file identity for upload rows: an icon that says WHAT the file
// is plus the extension in mono — never a list of eleven identical grey
// paperclips (doc 30 §7). Images additionally get a thumbnail where the row
// renders one; this is the fallback identity every row carries.
// Mobbin: https://mobbin.com/screens/77f399e9-65be-4bf0-9ae9-462c63a5f547 (Mistral — a red PDF glyph makes the one PDF findable in a list) · https://mobbin.com/screens/95680c5b-7ba8-4a2a-b231-ea4c27e11921 (Mistral Studio — type badge beside every filename, sizes in mono so the column aligns). Structure only.
// SOT: docs/pack/30-upload-surfaces-spec.md §7
// SOT-KEYWORDS: file glyph icon extension mono row upload identity type
import { Text, View } from '@acme/ui/tw';
import { AudioLines, FileSpreadsheet, FileText, Image as ImageIcon } from '@acme/ui/icons';
import { kindForMime } from './upload-surfaces.shared.ts';

export interface FileGlyphProps {
  name: string;
  mimeType: string;
}

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toUpperCase().slice(0, 4) : '';
};

export function FileGlyph({ name, mimeType }: FileGlyphProps) {
  const kind = kindForMime(mimeType);
  const spreadsheet = /spreadsheetml|csv/.test(mimeType);
  const Icon =
    kind === 'image' ? ImageIcon : kind === 'audio' ? AudioLines : spreadsheet ? FileSpreadsheet : FileText;
  const ext = extensionOf(name);
  return (
    <View className="w-11 items-center gap-0.5">
      <Icon size={20} className="text-text-muted" />
      {ext ? (
        <Text className="font-mono text-caption text-text-muted" aria-hidden>
          {ext}
        </Text>
      ) : null}
    </View>
  );
}
