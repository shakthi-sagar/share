import type { Workspace } from "./types";

const DATABASE_NAME = "share-local-workspaces";
const DATABASE_VERSION = 1;
const STORE_NAME = "workspaces";
let databasePromise: Promise<IDBDatabase> | undefined;

export const workspaceStore = {
  async create(workspace: Workspace): Promise<Workspace> {
    await put(workspace, true);
    return workspace;
  },

  async get(id: string): Promise<Workspace | null> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
      request.onsuccess = () => resolve((request.result as Workspace | undefined) ?? null);
      request.onerror = () => reject(request.error ?? new Error("Unable to read workspace"));
    });
  },

  async list(): Promise<Workspace[]> {
    const database = await openDatabase();
    return new Promise((resolve, reject) => {
      const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
      request.onsuccess = () =>
        resolve(
          (request.result as Workspace[]).sort((left, right) => right.updatedAt - left.updatedAt),
        );
      request.onerror = () => reject(request.error ?? new Error("Unable to list workspaces"));
    });
  },

  async update(workspace: Workspace): Promise<Workspace> {
    await put(workspace, false);
    return workspace;
  },

  async delete(id: string): Promise<void> {
    const database = await openDatabase();
    await transactionPromise(database, "readwrite", (store) => store.delete(id));
  },
};

async function put(workspace: Workspace, createOnly: boolean): Promise<void> {
  const database = await openDatabase();
  await transactionPromise(database, "readwrite", (store) =>
    createOnly ? store.add(workspace) : store.put(workspace),
  );
}

function openDatabase(): Promise<IDBDatabase> {
  databasePromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        const store = request.result.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => {
        request.result.close();
        databasePromise = undefined;
      };
      resolve(request.result);
    };
    request.onerror = () => {
      databasePromise = undefined;
      reject(request.error ?? new Error("Unable to open local workspaces"));
    };
  });
  return databasePromise;
}

function transactionPromise(
  database: IDBDatabase,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, mode);
    run(transaction.objectStore(STORE_NAME));
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Workspace storage failed"));
    transaction.onabort = () => reject(transaction.error ?? new Error("Workspace storage stopped"));
  });
}
