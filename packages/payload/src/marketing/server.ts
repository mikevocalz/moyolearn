import '@tanstack/react-start/server-only';
// Native Payload server entry. The adapter blocks config and Node modules in browsers;
// Next consumers additionally import this behind their server-only wrappers.
// SOT: docs/site/signaliq-business-connection.md
// SOT-KEYWORDS: marketing payload server boundary exports
export * from './marketing.repository.ts';
export * from './marketing.service.ts';
export * from './marketing-access.ts';
