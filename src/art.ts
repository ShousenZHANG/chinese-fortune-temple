// Pictures under public/art, made by scripts/art.py from the GPT Image set. Hall pictures are 480 px squares
// shown through a round moon gate; the courtyard comes in two widths.
import { h } from './dom';
import { tr } from './i18n';

export type HallId = 'qiuqian' | 'yuelao' | 'huangli' | 'wenxin' | 'ziwei' | 'xuyuan';

export const artUrl = (file: string): string => `${import.meta.env.BASE_URL}art/${file}`;

/** The hall's picture inside a moon gate. Decorative: the hall's name is always written next to it. */
export function moonGate(hall: HallId): HTMLImageElement {
  return h('img', { class: 'moon', src: artUrl(`hall-${hall}.webp`), alt: '', width: '480', height: '480',
    loading: 'lazy', decoding: 'async' });
}

export function courtyard(): HTMLImageElement {
  return h('img', { class: 'panorama-img', src: artUrl('courtyard-768.webp'),
    srcset: `${artUrl('courtyard-768.webp')} 768w, ${artUrl('courtyard-1536.webp')} 1536w`,
    sizes: '(min-width: 64rem) 64rem, 100vw', width: '1536', height: '1024', decoding: 'async',
    alt: tr('有据山寺全景：山门、中庭、几座殿和一棵挂满红绸的许愿树，背后是青绿远山', 'The temple: the gate, the courtyard, the halls and a wish tree hung with red ribbons, before blue-green mountains') });
}

/** The guide pointing the way; what he says is written beside him. */
export function guideMonk(): HTMLImageElement {
  return h('img', { class: 'monk', src: artUrl('monk-point.webp'), alt: '', width: '315', height: '480',
    decoding: 'async' });
}
