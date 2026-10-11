import type { RawPayloadRecord } from "../types.ts"
import { RAW_PAYLOADS_STORE, getBookmarksDb, requestToPromise, transactionDone } from "./db.ts"

export async function upsertRawPayloads(rawPayloads: RawPayloadRecord[]) {
  if (!rawPayloads.length) {
    return
  }

  const db = await getBookmarksDb()
  const transaction = db.transaction(RAW_PAYLOADS_STORE, "readwrite")
  const store = transaction.objectStore(RAW_PAYLOADS_STORE)

  for (const rawPayload of rawPayloads) {
    store.put(rawPayload)
  }

  await transactionDone(transaction)
}

export async function getRawPayload(tweetId: string) {
  const db = await getBookmarksDb()
  const transaction = db.transaction(RAW_PAYLOADS_STORE, "readonly")
  const store = transaction.objectStore(RAW_PAYLOADS_STORE)
  const record = (await requestToPromise(store.get(tweetId))) as RawPayloadRecord | undefined
  await transactionDone(transaction)

  return record?.payload
}

