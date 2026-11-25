import 'server-only';
// Next's service facade uses the shared protected domain, never the persistence package.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing shared domain service boundary
export * from '@acme/app/marketing';
