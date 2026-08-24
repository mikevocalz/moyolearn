// The single server action of doc 06 §2: create the learner user (username
// credential) → write the guardianship → write the consent → apply the
// restricted-account flags. Ordered so that a failure can never leave a child
// account standing without the consent that authorised it.
// SOT: docs/pack/06-auth-onboarding-spec.md §2 §6
// SOT-KEYWORDS: create learner guardian consent server-action rollback coppa

import { randomUUID } from 'node:crypto';
import {
  learnerPlaceholderEmail,
  validateCreateLearner,
  type CreateLearnerInput,
} from './create-learner.ts';

/** Only the writes this action needs, so it can be exercised without a database. */
export interface LearnerWriter {
  createUser(input: {
    email: string;
    password: string;
    name: string;
    username: string;
  }): Promise<{ id: string }>;
  deleteUser(id: string): Promise<void>;
  createGuardianship(input: { guardianAuthId: string; learnerAuthId: string }): Promise<void>;
  createConsent(input: {
    learnerAuthId: string;
    guardianAuthId: string;
    method: string;
    scope: string;
    policyVersion: string;
    evidenceRef?: string;
    grantedAt: string;
  }): Promise<void>;
}

export class CreateLearnerError extends Error {}

export async function createManagedLearner(
  writer: LearnerWriter,
  input: CreateLearnerInput,
): Promise<{ learnerAuthId: string }> {
  const check = validateCreateLearner(input);
  if (!check.ok) throw new CreateLearnerError(check.reason);

  const { id } = await writer.createUser({
    email: learnerPlaceholderEmail(randomUUID()),
    password: input.password,
    name: input.displayName,
    username: input.username,
  });

  try {
    await writer.createGuardianship({ guardianAuthId: input.guardianAuthId, learnerAuthId: id });
    await writer.createConsent({
      learnerAuthId: id,
      guardianAuthId: input.guardianAuthId,
      method: input.consent.method,
      scope: input.consent.scope,
      policyVersion: input.consent.policyVersion,
      evidenceRef: input.consent.evidenceRef,
      grantedAt: new Date().toISOString(),
    });
  } catch (cause) {
    // The learner user and the two Payload rows live in different schemas, so
    // there is no one transaction to roll back. Compensating instead: a child
    // account that outlived its consent write is the one outcome this action
    // must never produce. The §6 seven-day sweep is the backstop if even this
    // fails, not the primary guard.
    await writer.deleteUser(id).catch(() => {});
    throw new CreateLearnerError(
      `Learner rolled back — consent or guardianship failed to write: ${String(cause)}`,
    );
  }

  return { learnerAuthId: id };
}
