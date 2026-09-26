// FD-26 · Delete account (web). Mounted in `(site)` beside `settings`, which is
// the only surface that links here — doc 38 keeps `account/*` inside every
// authed guard rather than in a role shell, so one route serves every role.
import { DeleteAccountScreen } from '@acme/app';

export default DeleteAccountScreen;
