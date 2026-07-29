// Provider-independent storage boundary (6B Enhancement). Domain code (campaign media, future
// avatar/content uploads) depends only on this port — never on a concrete vendor. Binary content
// never goes into PostgreSQL; only keys/URLs/metadata are persisted there.
export const STORAGE_PORT = Symbol("STORAGE_PORT");

export interface StoredObject {
  storageKey: string;
  publicUrl: string;
}

export interface StoragePort {
  /** Persist a binary object under the given key. Overwrites are allowed (keys are unique per upload). */
  put(storageKey: string, content: Buffer, mimeType: string): Promise<StoredObject>;
  /** Remove an object; must be a no-op (not an error) if the key is already gone. */
  remove(storageKey: string): Promise<void>;
  /** Resolve the externally reachable URL for a key. */
  publicUrl(storageKey: string): string;
}
