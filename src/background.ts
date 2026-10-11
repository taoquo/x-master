import { reconcileInterruptedRuns } from "./background/index.ts"

// The worker starts for each event batch, so anything still marked in flight at
// this point belongs to a previous, already-terminated worker.
void reconcileInterruptedRuns()
