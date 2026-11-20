// 香客簿 and 愿望簿 in IndexedDB. The database version is the index into MIGRATIONS: opening at a higher version runs
// every step the stored copy has not seen yet, so adding a store never touches what is already kept.
import { InvalidRecord, parsePilgrim, type Pilgrim } from './pilgrim';
import { parseWish, type Wish } from './wish';

const DB_NAME = 'youju-shansi';
const MIGRATIONS: ((db: IDBDatabase) => void)[] = [
  (db) => db.createObjectStore('pilgrims', { keyPath: 'id' }),
  (db) => db.createObjectStore('wishes', { keyPath: 'id' }),
];
type StoreName = 'pilgrims' | 'wishes';
const BACKUP_FORMAT = 'youju-shansi-backup';
// Version 1 files carry only pilgrims; they still import, with no wishes.
const BACKUP_VERSION = 2;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  pilgrims: Pilgrim[];
  wishes: Wish[];
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

async function write(names: StoreName[], change: (stores: Record<StoreName, IDBObjectStore>) => void): Promise<void> {
  const tx = (await open()).transaction(names, 'readwrite');
  change(Object.fromEntries(names.map((name) => [name, tx.objectStore(name)])) as Record<StoreName, IDBObjectStore>);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function all<T>(name: StoreName): Promise<T[]> {
  return done((await open()).transaction(name).objectStore(name).getAll() as IDBRequest<T[]>);
}

export async function listPilgrims(): Promise<Pilgrim[]> {
  return (await all<Pilgrim>('pilgrims')).sort((a, b) => a.addedAt.localeCompare(b.addedAt));
}

export const savePilgrim = (pilgrim: Pilgrim): Promise<void> => write(['pilgrims'], (s) => s.pilgrims.put(pilgrim));
export const deletePilgrim = (id: string): Promise<void> => write(['pilgrims'], (s) => s.pilgrims.delete(id));

export async function listWishes(): Promise<Wish[]> {
  return (await all<Wish>('wishes')).sort((a, b) => b.madeOn.localeCompare(a.madeOn) || a.id.localeCompare(b.id));
}

export const saveWish = (wish: Wish): Promise<void> => write(['wishes'], (s) => s.wishes.put(wish));

/** Empties both books in one transaction. */
export const clearAll = (): Promise<void> => write(['pilgrims', 'wishes'], (s) => {
  s.pilgrims.clear();
  s.wishes.clear();
});

export async function exportBackup(): Promise<Backup> {
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(),
    pilgrims: await listPilgrims(), wishes: await listWishes() };
}

function each<T>(raw: unknown[], what: string, parse: (item: unknown) => T): T[] {
  return raw.map((item, i) => {
    try {
      return parse(item);
    } catch (error) {
      throw error instanceof InvalidRecord ? new InvalidRecord(`${what}第 ${i + 1} 条：${error.message}`) : error;
    }
  });
}

/** Reads an exported file; throws InvalidRecord before anything is written if any record in it is unusable. */
export function parseBackup(text: string, knownCity: (name: string) => boolean): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    raw = null;
  }
  const value = raw as { format?: unknown; version?: unknown; exportedAt?: unknown; pilgrims?: unknown; wishes?: unknown } | null;
  if (value?.format !== BACKUP_FORMAT || !Array.isArray(value.pilgrims)) {
    throw new InvalidRecord('这个文件不是有据山寺导出的香客簿文件。');
  }
  if (value.version !== 1 && value.version !== BACKUP_VERSION) {
    throw new InvalidRecord(`文件版本 ${String(value.version)} 认不出，请用新版页面导出。`);
  }
  const wishes = value.version === 1 ? [] : value.wishes;
  if (!Array.isArray(wishes)) throw new InvalidRecord('文件里的愿望簿读不出来。');
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: String(value.exportedAt ?? ''),
    pilgrims: each(value.pilgrims, '香客', (p) => parsePilgrim(p, knownCity)), wishes: each(wishes, '愿望', parseWish) };
}

/** Adds or replaces each record by id in one transaction, so importing the same file twice changes nothing. */
export const importBackup = (backup: Backup): Promise<void> => write(['pilgrims', 'wishes'], (s) => {
  backup.pilgrims.forEach((pilgrim) => s.pilgrims.put(pilgrim));
  backup.wishes.forEach((wish) => s.wishes.put(wish));
});
