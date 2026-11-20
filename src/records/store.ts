// 香客簿 in IndexedDB. The database version is the index into MIGRATIONS: opening at a higher version runs every
// step the stored copy has not seen yet, so a later 愿望簿 adds a store without touching the people already kept.
import { InvalidRecord, parsePilgrim, type Pilgrim } from './pilgrim';

const DB_NAME = 'youju-shansi';
const MIGRATIONS: ((db: IDBDatabase) => void)[] = [
  (db) => db.createObjectStore('pilgrims', { keyPath: 'id' }),
];
const BACKUP_FORMAT = 'youju-shansi-backup';
const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  pilgrims: Pilgrim[];
}

let opened: Promise<IDBDatabase> | null = null;

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function open(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, MIGRATIONS.length);
    request.onupgradeneeded = (event) => {
      for (const step of MIGRATIONS.slice(event.oldVersion)) step(request.result);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return opened;
}

async function write(change: (store: IDBObjectStore) => void): Promise<void> {
  const tx = (await open()).transaction('pilgrims', 'readwrite');
  change(tx.objectStore('pilgrims'));
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function listPilgrims(): Promise<Pilgrim[]> {
  const tx = (await open()).transaction('pilgrims');
  const all = await done(tx.objectStore('pilgrims').getAll() as IDBRequest<Pilgrim[]>);
  return all.sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export const savePilgrim = (pilgrim: Pilgrim): Promise<void> => write((store) => store.put(pilgrim));
export const deletePilgrim = (id: string): Promise<void> => write((store) => store.delete(id));
export const clearPilgrims = (): Promise<void> => write((store) => store.clear());

export async function exportBackup(): Promise<Backup> {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    pilgrims: await listPilgrims() };
}

/** Reads an exported file; throws InvalidRecord before anything is written if any person in it is unusable. */
export function parseBackup(text: string, knownCity: (name: string) => boolean): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const value = raw as Partial<Backup> | null;
  if (value?.format !== BACKUP_FORMAT || !Array.isArray(value.pilgrims)) {
    throw new InvalidRecord('这个文件不是有据山寺导出的香客簿文件。');
  }
  if (value.version !== BACKUP_VERSION) throw new InvalidRecord(`文件版本 ${String(value.version)} 认不出，请用新版页面导出。`);
  const pilgrims = value.pilgrims.map((person, i) => {
    try {
      return parsePilgrim(person, knownCity);
    } catch (error) {
      throw error instanceof InvalidRecord ? new InvalidRecord(`第 ${i + 1} 位：${error.message}`) : error;
    }
  });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: String(value.exportedAt ?? ''), pilgrims };
}

/** Adds or replaces each person by id in one transaction, so importing the same file twice changes nothing. */
export const importBackup = (backup: Backup): Promise<void> =>
  write((store) => backup.pilgrims.forEach((pilgrim) => store.put(pilgrim)));
