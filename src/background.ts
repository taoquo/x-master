import { handleKeepAliveTick, reconcileInterruptedRuns } from "./background/index.ts"
import { restrictStorageToTrustedContexts } from "./lib/storage/secrets.ts"
import { attachKeepAliveListenerAtStartup } from "./lib/runtime/keepAlive.ts"

// This area holds the LLM API key, and it is readable by content scripts unless it
// is restricted. Set before anything can read it.
void restrictStorageToTrustedContexts()

// The worker starts for each event batch, so anything still marked in flight at
// this point belongs to a previous, already-terminated worker.
// Registered at the top level on purpose: it is what lets Chrome wake this worker
// for a keep-alive alarm after a previous invocation was killed, which is the only
// way an interrupted run can be reported and continued.
if (typeof chrome !== "undefined" && chrome.alarms?.onAlarm) {
  chrome.alarms.onAlarm.addListener(() => {
    void handleKeepAliveTick()
  })
}

attachKeepAliveListenerAtStartup()

void reconcileInterruptedRuns()
