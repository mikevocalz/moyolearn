// The shape tus-js-client expects of a URL store, restated locally so the two
// platform forks are held to one contract.
// SOT-KEYWORDS: tus url storage resume upload media types
import type { UploadOptions } from 'tus-js-client';

export type TusUrlStorage = NonNullable<UploadOptions['urlStorage']>;
