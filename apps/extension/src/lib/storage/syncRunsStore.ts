import type { SyncRunRecord } from "../types.ts"
import { getBookmarksDb, requestToPromise, SYNC_RUNS_STORE, transactionDone } from "./db.ts"

export async function createSyncRun(syncRun: SyncRunRecord) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(SYNC_RUNS_STORE, "readwrite")
  const store = transaction.objectStore(SYNC_RUNS_STORE)
  store.put(syncRun)
  await transactionDone(transaction)
}

export async function getLatestSyncRun(): Promise<SyncRunRecord | null> {
  const db = await getBookmarksDb()
  const transaction = db.transaction(SYNC_RUNS_STORE, "readonly")
  const store = transaction.objectStore(SYNC_RUNS_STORE)
  const syncRuns = await requestToPromise(store.getAll())
  await transactionDone(transaction)

  if (!syncRuns.length) {
    return null
  }

  return syncRuns[syncRuns.length - 1] as SyncRunRecord
}
