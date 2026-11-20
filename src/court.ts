// 中庭, laid out like a temple plan: 紫微殿 at the back of the axis, 求签殿 in the middle, the gate at the front,
// side halls on either hand.
import { artUrl, guideMonk, moonGate, type HallId } from './art';
import { h } from './dom';
import { dailySlip } from './daily';
import { placeName, tr } from './i18n';
import { dharmaName } from './name';
import { scene } from './scene';
import { zen } from './zen';
import { confirmedTimezone, guessedTimezone, localMoment } from './moment';
import { listWishes } from './records/store';
import { dueWishes } from './records/wish';

interface Hall {
  id: HallId;
  name: string;
  does: [zh: string, en: string];
}

const HALLS: Hall[] = [
  { id: 'qiuqian', name: '求签殿', does: ['亲手掷六次铜钱，起一卦问一件事', 'Toss three coins six times yourself and ask one question'] },
  { id: 'yuelao', name: '月老殿', does: ['两人的八字合婚，看合冲刑害', 'Two birth charts side by side: where they combine and clash'] },
  { id: 'wenxin', name: '问心堂', does: ['写下心事，得一条现实建议', 'Write down a worry and get practical advice'] },
  { id: 'ziwei', name: '紫微殿', does: ['紫微斗数，看事业、感情、财运', 'A Zi Wei Dou Shu chart for work, love or money'] },
  { id: 'huangli', name: '黄历亭', does: ['今日、本周等级与择日', 'Today, this week, and picking a day'] },
  { id: 'xuyuan', name: '许愿树', does: ['许一个愿，到期回来还愿', 'Make a wish and come back to fulfil it'] },
];

function hallTile(hall: Hall): HTMLElement {
  return h('a', { class: `hall-tile at-${hall.id}`, href: `#/${hall.id}` },
    moonGate(hall.id),
    h('span', { class: 'label' },
      h('span', { class: 'plaque' }, placeName(hall.name)),
      h('span', { class: 'does' }, tr(...hall.does))));
}

function panorama(monk: HTMLImageElement): HTMLElement {
  const name = dharmaName();
  return h('figure', { class: 'panorama' },
    scene(),
    h('figcaption', { class: 'guide', 'data-testid': 'guide' },
      monk,
      h('p', { class: 'say' }, tr(`${name}，想问哪件事，就进哪座殿。急着求一支签，就去正中的求签殿。`,
        `${name}, go into the hall for what you want to ask. In a hurry? The Coin Hall in the middle.`)),
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
    const more = due.length - 1;
    slot.replaceChildren(h('aside', { class: 'reminder', 'aria-label': tr('还愿提醒', 'Wish reminder') },
      h('p', {}, tr(`你在 ${year} 年 ${month} 月许的${first.category}之愿到了还愿的日子${more ? `，另有 ${more} 个也到了` : ''}。`,
        `The wish (${first.category}) you made in ${year}-${String(month).padStart(2, '0')} has reached its return day`
          + `${more ? `, and ${more} more have too` : ''}.`)),
      h('a', { href: '#/xuyuan' }, tr('去许愿树', 'Go to the Wish Tree'))));
  }).catch(() => undefined);
  return slot;
}

export function court(): HTMLElement {
  const monk = guideMonk();
  return h('div', { class: 'court-view' },
    reminders(),
    panorama(monk),
    h('section', { class: 'court', 'aria-label': tr('中庭', 'Courtyard') },
      ...HALLS.map(hallTile),
      h('div', { class: 'gate' },
        h('span', { class: 'plaque small' }, placeName('山门')),
        h('p', {}, tr('不用注册。出生资料和心愿只存在这台设备上。', 'No sign-up. Birth details and wishes stay on this device.')),
        h('a', { class: 'gate-link', href: '#/xiangke' }, placeName('香客簿')),
        h('a', { class: 'gate-link', href: '#/yuanqi' }, placeName('缘起')),
      ),
    ),
    dailySlip(),
    zen(() => bow(monk)),
  );
}
