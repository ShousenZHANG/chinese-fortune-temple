// One person in 香客簿, and the two ways a hall hands them to the Skill. Records come from the form or from an
// imported file; both pass through parsePilgrim, so everything after it trusts the shape.
export type Gender = 'male' | 'female';

export type BirthDate =
  | { calendar: 'solar'; year: number; month: number; day: number }
  | { calendar: 'lunar'; year: number; month: number; day: number; leap: boolean };

export type BirthTime = { known: true; hour: number; minute: number } | { known: false };

export interface Pilgrim {
  id: string;
  name: string;
  gender: Gender;
  date: BirthDate;
  time: BirthTime;
  /** A name from the Skill's cities_cn.json; the Skill turns it into longitude and time zone itself. */
  city: string;
  addedAt: string;
}

/** The record is unusable; the message says which field and is shown to the visitor as is. */
export class InvalidRecord extends Error {}

export const NAME_MAX = 20;
const YEARS = { min: 1900, max: 2100 };
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊'];
const LUNAR_TENS = ['初', '十', '廿', '三'];
const DIGITS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

function integer(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) {
    throw new InvalidRecord(`${field}要在 ${min} 到 ${max} 之间。`);
  }
  return value;
}

function record(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new InvalidRecord(`缺少${field}。`);
  return value as Record<string, unknown>;
}

function parseDate(raw: unknown): BirthDate {
  const date = record(raw, '出生日期');
  const year = integer(date.year, '出生年份', YEARS.min, YEARS.max);
  const month = integer(date.month, '月份', 1, 12);
  if (date.calendar === 'lunar') {
    return { calendar: 'lunar', year, month, day: integer(date.day, '农历日', 1, 30), leap: date.leap === true };
  }
  if (date.calendar !== 'solar') throw new InvalidRecord('历法只能是公历或农历。');
  const day = integer(date.day, '日', 1, 31);
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day > last) throw new InvalidRecord(`公历 ${year} 年 ${month} 月没有 ${day} 日。`);
  return { calendar: 'solar', year, month, day };
}

function parseTime(raw: unknown): BirthTime {
  const time = record(raw, '出生时间');
  if (time.known === false) return { known: false };
  return { known: true, hour: integer(time.hour, '时', 0, 23), minute: integer(time.minute, '分', 0, 59) };
}

/** Turns untrusted input into a Pilgrim, or throws InvalidRecord naming the first field that is wrong. */
export function parsePilgrim(raw: unknown, knownCity: (name: string) => boolean): Pilgrim {
  const value = record(raw, '香客资料');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!name || name.length > NAME_MAX) throw new InvalidRecord(`称呼要写 1 到 ${NAME_MAX} 个字。`);
  if (value.gender !== 'male' && value.gender !== 'female') throw new InvalidRecord('请选性别。');
  const city = typeof value.city === 'string' ? value.city.trim() : '';
  if (!knownCity(city)) throw new InvalidRecord(city ? `城市表里没有「${city}」，请从列表里选。` : '请选出生地。');
  if (typeof value.id !== 'string' || !value.id) throw new InvalidRecord('记录缺少编号。');
  const addedAt = typeof value.addedAt === 'string' && !Number.isNaN(Date.parse(value.addedAt))
    ? value.addedAt : new Date().toISOString();
  return { id: value.id, name, gender: value.gender, date: parseDate(value.date), time: parseTime(value.time), city,
    addedAt };
}

const pad = (n: number) => String(n).padStart(2, '0');

function lunarDay(day: number): string {
  if (day === 10) return '初十';
  if (day === 20) return '二十';
  if (day === 30) return '三十';
  return LUNAR_TENS[Math.floor(day / 10)] + DIGITS[day % 10];
}

/** "公历 1990-06-12，时辰不知道，北京" or "农历 1992 年八月廿二 08:30，香港". */
export function describeBirth(p: Pilgrim): string {
  const { date, time } = p;
  const day = date.calendar === 'solar'
    ? `公历 ${date.year}-${pad(date.month)}-${pad(date.day)}`
    : `农历 ${date.year} 年${date.leap ? '闰' : ''}${LUNAR_MONTHS[date.month - 1]}月${lunarDay(date.day)}`;
  return `${day}${time.known ? ` ${pad(time.hour)}:${pad(time.minute)}` : '，时辰不知道'}，${p.city}`;
}

export const genderName = (gender: Gender): string => (gender === 'male' ? '男' : '女');


/** The birth object the Skill's stdin tools take (pair_facts, bazi_calc keys). No hour means the hour is unknown;
 *  a leap lunar month is a negative month, as bazi_calc reads it. */
export function birthJson(p: Pilgrim): Record<string, unknown> {
  const { date, time } = p;
  const leap = date.calendar === 'lunar' && date.leap;
  return {
    year: date.year, month: leap ? -date.month : date.month, day: date.day, gender: p.gender, city: p.city,
    ...(date.calendar === 'lunar' ? { lunar: true } : {}),
    ...(time.known ? { hour: time.hour, minute: time.minute } : {}),
  };
}

export type WithHour = Pilgrim & { time: { known: true; hour: number; minute: number } };
export const hasHour = (p: Pilgrim): p is WithHour => p.time.known;

/** The same birth as command-line flags (ziwei_calc). Only for a known hour: the chart cannot be drawn without it. */
export function birthArgs(p: WithHour): string[] {
  const { date, time } = p;
  return ['--year', String(date.year), '--month', String(date.month), '--day', String(date.day),
    '--hour', String(time.hour), '--minute', String(time.minute), '--gender', p.gender, '--city', p.city,
    ...(date.calendar === 'lunar' ? ['--lunar', ...(date.leap ? ['--leap'] : [])] : [])];
}
