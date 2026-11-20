// 中庭, laid out like a temple plan: 紫微殿 at the back of the axis, 求签殿 in the middle, the gate at the front,
// side halls on either hand. Halls that are not built yet say so instead of linking nowhere.
import { artUrl, guideMonk, moonGate, type HallId } from './art';
import { h } from './dom';
import { dharmaName } from './name';
import { scene } from './scene';
import { zen } from './zen';
import { confirmedTimezone, guessedTimezone, localMoment } from './moment';
import { listWishes } from './records/store';
import { dueWishes } from './records/wish';

interface Hall {
  id: HallId;
  name: string;
  does: string;
  open: boolean;
}

const HALLS: Hall[] = [
  { id: 'qiuqian', name: '求签殿', does: '亲手掷六次铜钱，起一卦问一件事', open: true },
  { id: 'yuelao', name: '月老殿', does: '两人的八字合婚，看合冲刑害', open: true },
  { id: 'wenxin', name: '问心堂', does: '写下心事，得一条现实建议', open: true },
  { id: 'ziwei', name: '紫微殿', does: '紫微斗数，看事业、感情、财运', open: true },
  { id: 'huangli', name: '黄历亭', does: '今日、本周等级与择日', open: true },
  { id: 'xuyuan', name: '许愿树', does: '许一个愿，到期回来还愿', open: true },
];

function hallTile(hall: Hall): HTMLElement {
  const body = [
    moonGate(hall.id),
    h('span', { class: 'label' },
      h('span', { class: 'plaque' }, hall.name),
      h('span', { class: 'does' }, hall.does, hall.open ? null : h('span', { class: 'later' }, '后续开放')),
    ),
  ];
  return hall.open
    ? h('a', { class: `hall-tile at-${hall.id}`, href: `#/${hall.id}` }, ...body)
    : h('div', { class: `hall-tile at-${hall.id} closed`, 'aria-disabled': 'true' }, ...body);
}

function panorama(monk: HTMLImageElement): HTMLElement {
  return h('figure', { class: 'panorama' },
    scene(),
    h('figcaption', { class: 'guide', 'data-testid': 'guide' },
      monk,
      h('p', { class: 'say' }, `${dharmaName()}，想问哪件事，就进哪座殿。急着求一支签，就去正中的求签殿。`),
    ),
  );
}

/** 合掌: the guide bows back for a moment. */
function bow(monk: HTMLImageElement): void {
  const pointing = monk.src;
  monk.src = artUrl('monk-bow.webp');
  setTimeout(() => { monk.src = pointing; }, 2500);
}

// Story 49: a wish whose return day has come is mentioned on the way in.
function reminders(): HTMLElement {
  const slot = h('div', { class: 'reminders' });
  const today = localMoment(confirmedTimezone() ?? guessedTimezone()).date;
  void listWishes().then((wishes) => {
    const due = dueWishes(wishes, today);
    if (!due.length) return;
    const first = due[0];
    const [year, month] = first.madeOn.split('-').map(Number);
    slot.replaceChildren(h('aside', { class: 'reminder', 'aria-label': '还愿提醒' },
      h('p', {}, `你在 ${year} 年 ${month} 月许的${first.category}之愿到了还愿的日子`
        + (due.length > 1 ? `，另有 ${due.length - 1} 个也到了` : '') + '。'),
      h('a', { href: '#/xuyuan' }, '去许愿树')));
  }).catch(() => undefined);
  return slot;
}

export function court(): HTMLElement {
  const monk = guideMonk();
  return h('div', { class: 'court-view' },
    reminders(),
    panorama(monk),
    h('section', { class: 'court', 'aria-label': '中庭' },
      ...HALLS.map(hallTile),
      h('div', { class: 'gate' },
        h('span', { class: 'plaque small' }, '山门'),
        h('p', {}, '不用注册。出生资料和心愿只存在这台设备上。'),
        h('a', { class: 'gate-link', href: '#/xiangke' }, '香客簿'),
      ),
    ),
    zen(() => bow(monk)),
  );
}
