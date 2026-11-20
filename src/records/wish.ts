// One wish in 愿望簿. A wish is made, then either fulfilled with an offering or released; the state carries what
// each outcome needs, so a released wish cannot hold an offering. Merit is the count of fulfilled wishes, nothing
// stored apart. Records come from the form or an imported file and both pass through parseWish.
import { InvalidRecord } from './pilgrim';

export const CATEGORIES = ['学业', '事业', '姻缘', '健康', '平安', '财运', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

export const OFFERINGS = { incense: '上一炷香', lamp: '点一盏灯', ribbon: '挂一条红绸' } as const;
export type Offering = keyof typeof OFFERINGS;

export type WishState =
  | { status: 'made' }
  | { status: 'fulfilled'; on: string; offering: Offering }
  | { status: 'released'; on: string };

export interface Wish {
  id: string;
  category: Category;
  text: string;
  madeOn: string;
  returnOn: string;
  /** The 签文卡 the wish was made from, if any. */
  source: { title: string; question: string } | null;
  state: WishState;
}

export const WISH_MAX = 100;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export const STATUS_NAMES: Record<WishState['status'], string> = { made: '已许', fulfilled: '已还', released: '已放下' };

// Wishes against someone else (spec story 55): a curse is refused on its own; harm words are refused when the wish
// names another person. Checked in this browser; nothing is sent anywhere.
const CURSES = ['诅咒', '去死', '不得好死', '遭报应', '下地狱', '断子绝孙', '天打雷劈', '死全家'];
const HARMS = ['死', '车祸', '生病', '得病', '出事', '倒霉', '破产', '失业', '被开除', '坐牢', '分手', '离婚', '受伤', '残废', '报复'];
const OTHERS = ['他', '她', '它们', '对方', '那个人', '那人', '前任', '前男友', '前女友', '老板', '领导', '同事', '室友', '邻居', '仇人', '小三', '情敌', '婆婆', '公公'];

// A harm word right after a negation is a wish against harm: 「不生病」「别分手」「远离车祸」.
const NEGATION = /[不别没无免少避防离]/;

function harmIn(text: string): string | undefined {
  return HARMS.find((word) => {
    for (let at = text.indexOf(word); at >= 0; at = text.indexOf(word, at + 1)) {
      if (!NEGATION.test(text.slice(Math.max(0, at - 3), at))) return true;
    }
    return false;
  });
}

/** Why the tree will not take this wish, or null when it can. */
export function refusal(raw: string): string | null {
  const text = raw.replace(/其[他它]/g, '');
  const curse = CURSES.find((word) => text.includes(word));
  const harm = harmIn(text);
  const other = OTHERS.find((word) => text.includes(word));
  if (!curse && !(harm && other)) return null;
  return `许愿树不收希望别人受害的愿望（这句里有「${curse ?? `${other}…${harm}`}」）。`
    + '如果有人伤害了你，可以写一个关于你自己的愿，比如平安离开、讨回公道；现实里怎么做，可以去问心堂问。';
}

/** Shown beside any wish about health (spec story 52); the wish is still taken. */
export const healthNote = (category: Category, text: string): string | null =>
  category === '健康' || /病|健康|手术|身体|住院/.test(text) ? '身体不适先就医。许愿是心意，不代替看病。' : null;

function date(value: unknown, field: string): string {
  if (typeof value !== 'string' || !DATE.test(value) || Number.isNaN(Date.parse(value))) throw new InvalidRecord(`${field}不是有效日期。`);
  return value;
}

function parseState(raw: unknown): WishState {
  const state = (raw ?? {}) as Record<string, unknown>;
  if (state.status === 'made') return { status: 'made' };
  if (state.status === 'released') return { status: 'released', on: date(state.on, '放下的日子') };
  if (state.status === 'fulfilled' && typeof state.offering === 'string' && state.offering in OFFERINGS) {
    return { status: 'fulfilled', on: date(state.on, '还愿的日子'), offering: state.offering as Offering };
  }
  throw new InvalidRecord('愿望的状态认不出。');
}

export function parseWish(raw: unknown): Wish {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (typeof value.id !== 'string' || !value.id) throw new InvalidRecord('愿望缺少编号。');
  if (!CATEGORIES.includes(value.category as Category)) throw new InvalidRecord('请选愿望的类别。');
  const text = typeof value.text === 'string' ? value.text.trim() : '';
  if (!text || text.length > WISH_MAX) throw new InvalidRecord(`心愿要写 1 到 ${WISH_MAX} 个字。`);
  const why = refusal(text);
  if (why) throw new InvalidRecord(why);
  const madeOn = date(value.madeOn, '许愿的日子');
  const returnOn = date(value.returnOn, '还愿日');
  if (returnOn <= madeOn) throw new InvalidRecord('还愿日要在许愿那天之后。');
  const source = value.source as Wish['source'] | undefined;
  return { id: value.id, category: value.category as Category, text, madeOn, returnOn,
    source: source && typeof source.title === 'string' && typeof source.question === 'string'
      ? { title: source.title, question: source.question } : null,
    state: parseState(value.state) };
}

/** Wishes still made whose return day has come. */
export const dueWishes = (wishes: Wish[], today: string): Wish[] =>
  wishes.filter((wish) => wish.state.status === 'made' && wish.returnOn <= today);

export const merit = (wishes: Wish[]): number => wishes.filter((wish) => wish.state.status === 'fulfilled').length;
