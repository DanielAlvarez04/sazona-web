import type { QueuedRound } from "./types"

/**
 * Persistencia local de la cola de sincronización.
 *
 * IndexedDB no guarda cookies, tokens ni credenciales: cada operación solo
 * contiene identificadores de producto, cantidades, notas y claves de
 * idempotencia. Las operaciones se etiquetan con el `userId` que las creó para
 * que otra cuenta en el mismo dispositivo no las vea ni las envíe.
 */

const DB_NAME = "np-offline"
const DB_VERSION = 1
const STORE = "operations"
const USER_INDEX = "userId"

let dbPromise: Promise<IDBDatabase> | null = null

function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined"
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise

  const opening = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" })
        store.createIndex(USER_INDEX, "userId", { unique: false })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error("IndexedDB bloqueada"))
  })

  dbPromise = opening.catch((error: unknown) => {
    dbPromise = null
    throw error
  })

  return dbPromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
    transaction.onabort = () => reject(transaction.error)
  })
}

export async function listQueuedRounds(userId: string): Promise<QueuedRound[]> {
  if (!hasIndexedDb()) return []

  try {
    const db = await openDb()
    const transaction = db.transaction(STORE, "readonly")
    const index = transaction.objectStore(STORE).index(USER_INDEX)
    const rows = await requestResult(index.getAll(userId) as IDBRequest<QueuedRound[]>)
    await transactionDone(transaction)
    return rows
  } catch {
    return []
  }
}

export async function putQueuedRound(operation: QueuedRound): Promise<void> {
  if (!hasIndexedDb()) return

  const db = await openDb()
  const transaction = db.transaction(STORE, "readwrite")
  transaction.objectStore(STORE).put(operation)
  await transactionDone(transaction)
}

export async function deleteQueuedRound(id: string): Promise<void> {
  if (!hasIndexedDb()) return

  const db = await openDb()
  const transaction = db.transaction(STORE, "readwrite")
  transaction.objectStore(STORE).delete(id)
  await transactionDone(transaction)
}

/** Borra la cola de una cuenta (por ejemplo, al descartar todo manualmente). */
export async function clearQueuedRounds(userId: string): Promise<void> {
  if (!hasIndexedDb()) return

  const db = await openDb()
  const transaction = db.transaction(STORE, "readwrite")
  const index = transaction.objectStore(STORE).index(USER_INDEX)
  const keys = await requestResult(
    index.getAllKeys(userId) as IDBRequest<IDBValidKey[]>
  )
  for (const key of keys) {
    transaction.objectStore(STORE).delete(key)
  }
  await transactionDone(transaction)
}
