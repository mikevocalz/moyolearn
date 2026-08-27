// The inference composition root — where the durable budget ledger is installed.
//
// `@acme/inference` owns the `BudgetLedger` PORT and cannot own its
// implementation: `tooling/check-no-training-path.mjs` fails the build if that
// package grows an import of a repository or the educational store, which is
// what keeps "the gateway holds provider credentials AND can read a child's
// record" from ever becoming true. So the port is filled from the app side, and
// this file is that side.
//
// It is a MODULE-SCOPE effect on purpose. The shared gateway is reached through
// defaulted parameters inside `packages/app/features/tutor`
// (`tutorTurnFor(learnerId, gateway = inferenceGateway())`), so no route can
// hand a ledger down to it; the only seam is the default itself. Importing this
// module — even as a bare import — is what fills that seam. Any route that can
// reach a model must import it, and the fallback in
// `packages/inference/src/budget.ts` says so loudly, once, if one forgets.
// SOT: packages/inference/src/budget.ts · apps/web/lib/budget-ledger.repository.ts · docs/pack/12-systems-design-prompt.md §7
// SOT-KEYWORDS: inference composition root budget ledger install durable gateway injection port learner daily
import 'server-only';
import { inferenceGateway, installBudgetLedger, type InferenceGateway } from '@acme/inference';
import { durableBudgetLedger } from './budget-ledger.repository';

/*
  Installed at module evaluation rather than lazily on first use.

  Lazy would mean the first tutoring turn after a cold start races the
  installation, and the loser of that race is a turn charged to a Map that dies
  with the lambda. `installBudgetLedger` is last-write-wins, so a module graph
  evaluated twice (dev recompiles, the server/edge split) is a second identical
  registration and not an error.

  `durableBudgetLedger()` opens nothing here — `withEdu` checks a connection out
  of Payload's pool per query and releases it — so a process that never coaches
  pays nothing for this line.
*/
installBudgetLedger(durableBudgetLedger());

/**
 * The gateway, with the durable ledger already behind it.
 *
 * Exported for the routes that CAN pass one down (`openSession` takes a gateway
 * argument). Routes that cannot — the coaching turn reaches the gateway four
 * frames deep — import this module for its effect instead. Both paths end at
 * the same singleton and the same Postgres row.
 */
export function budgetedGateway(): InferenceGateway {
  return inferenceGateway();
}
