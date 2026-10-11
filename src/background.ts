import { reconcileInterruptedRuns } from "./background/index.ts"
import { restrictStorageToTrustedContexts } from "./lib/storage/secrets.ts"

// This area holds the LLM API key, and it is readable by content scripts unless it
// is restricted. Set before anything can read it.
void restrictStorageToTrustedContexts()

// The worker starts for each event batch, so anything still marked in flight at
// this point belongs to a previous, already-terminated worker.
void reconcileInterruptedRuns()
