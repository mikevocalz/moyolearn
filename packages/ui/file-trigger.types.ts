// The one contract both FileTrigger forks honour.
// SOT: docs/pack/30-upload-surfaces-spec.md §6
// SOT-KEYWORDS: file trigger types input picker accessible keyboard upload
export interface FileTriggerFile {
  /** Object URL on web, picker URI on native. */
  uri: string;
  name: string;
  type: string;
  size: number;
}

export interface FileTriggerProps {
  /** Accessible name — "Upload files", "Replace profile photo". Required: an unlabelled file input announces as "button". */
  label: string;
  /** MIME/extension filter for the web input (`image/*`, `.pdf,application/pdf`). */
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  /** Files the user chose. Web only — native settles through `onPickRequest`'s picker. */
  onFiles: (files: FileTriggerFile[]) => void;
  /**
   * Native tap. Touch has no `<input type="file">`; the platform picker is the
   * dialog, and OPENING it stays the caller's job so camera/library/document
   * routing lives with the feature, not the kit.
   */
  onPickRequest?: () => void;
  className?: string;
  children?: React.ReactNode;
}
