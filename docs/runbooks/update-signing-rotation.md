# Runbook — EAS Update code-signing key rotation

**Owner:** security coordinator (doc 07 §5). **Cadence:** annually, and immediately on suspected compromise.
**Why annual:** the certificate is minted with one-year validity on purpose — Expo's own guidance is that shorter validity limits the exposure window from a compromised private key. A key with a five-year certificate is a key nobody will ever rotate.

## What lives where

| Artifact | Location | Committed |
|---|---|---|
| `certificate.pem` | `apps/mobile/certs/` | **Yes** — it is public by construction, and the build reads it. A missing certificate does not fail loudly; it silently ships unsigned updates, which is why `tooling/check-code-signing.mjs` fails the build instead. |
| `private-key.pem` | KMS | **Never.** `apps/mobile/keys/` is gitignored. A copy on a laptop is a copy in a backup. |
| `public-key.pem` | KMS alongside the private key | No. Only needed to re-mint a certificate for the same key pair. |

## Rotation

1. Mint a new pair and certificate:
   `npx expo-updates codesigning:generate --key-output-directory keys --certificate-output-directory certs --certificate-validity-duration-years 1 --certificate-common-name "Moyo Learning"`
2. Commit the new `apps/mobile/certs/certificate.pem`. Leave `app.config.ts`'s `codeSigningMetadata` alone unless the algorithm changed.
3. Upload the new private key to KMS; keep the previous key until every client has taken an update built against the new certificate.
4. Ship a build. **Clients verify against the certificate embedded in their installed binary**, so an update signed with the new key is rejected by clients still running the old build — the old key must keep signing until that population is drained, then be destroyed.
5. Record the rotation date and the retired key's destruction in the security program doc (doc 07 §5).

## On suspected compromise

Skip the drain in step 4: rotate, ship, and accept that clients on the old build cannot take updates until they update through the store. An attacker who can sign updates can ship code to children's devices; a stalled update channel is the cheaper outcome.
