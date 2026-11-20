// The random 法名 a visitor gets at the gate (spec story 2), kept in this browser. Two characters from two lists of
// quiet words, never the same character twice.
const FIRST = ['闲', '静', '清', '明', '慧', '澄', '觉', '素', '安', '若', '怀', '归', '青', '松', '守', '知', '和', '妙'];
const SECOND = ['云', '月', '风', '溪', '山', '竹', '心', '然', '远', '舟', '石', '泉', '川', '禾', '林', '鹤', '光', '雨'];
const KEY = 'temple.dharma-name';

function pick<T>(list: readonly T[], random: () => number): T {
  return list[Math.floor(random() * list.length)];
}

export function newName(random: () => number = Math.random, avoid = ''): string {
  for (;;) {
    const name = pick(FIRST, random) + pick(SECOND, random);
    if (name[0] !== name[1] && name !== avoid) return name;
  }
}

function store(name: string): string {
  try {
    localStorage.setItem(KEY, name);
  } catch {
    // Storage blocked: the name lasts for this page.
  }
  return name;
}

export function dharmaName(): string {
  try {
    const kept = localStorage.getItem(KEY);
    if (kept) return kept;
  } catch {
    // Fall through to a fresh name.
  }
  return store(newName());
}

export const renameDharma = (): string => store(newName(Math.random, dharmaName()));
