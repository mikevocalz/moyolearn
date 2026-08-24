import { baseConfig } from '@acme/config/eslint/base.mjs';

// This package owns the Better Auth integration, so auth SDK imports are
// expected here while remaining restricted elsewhere in the workspace.
export default [...baseConfig(), { rules: { 'no-restricted-imports': 'off' } }];
