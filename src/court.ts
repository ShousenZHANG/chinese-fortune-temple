// 中庭, laid out like a temple plan: 紫微殿 at the back of the axis, 求签殿 in the middle, the gate at the front,
// side halls on either hand. Halls that are not built yet say so instead of linking nowhere.
import { courtyard, guideMonk, moonGate, type HallId } from './art';
import { h } from './dom';

interface Hall {
  id: HallId;
  name: string;
  does: string;
  open: boolean;
}

const HALLS: Hall[] = [
  { id: 'qiuqian', name: '求签殿', does: '亲手掷六次铜钱，起一卦问一件事', open: true },
  { id: 'yuelao', name: '月老殿', does: '两人的八字合婚，看合冲刑害', open: true },
  { id: 'wenxin', name: '问心堂', does: '写下心事，得一条现实建议', open: false },
  { id: 'ziwei', name: '紫微殿', does: '紫微斗数，看事业、感情、财运', open: true },
  { id: 'huangli', name: '黄历亭', does: '今日、本周等级与择日', open: true },
  { id: 'xuyuan', name: '许愿树', does: '许一个愿，到期回来还愿', open: false },
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

function panorama(): HTMLElement {
  return h('figure', { class: 'panorama' },
    courtyard(),
    h('figcaption', { class: 'guide', 'data-testid': 'guide' },
      guideMonk(),
      h('p', { class: 'say' }, '想问哪件事，就进哪座殿。求签殿、月老殿、紫微殿、黄历亭已经开门，问心堂和许愿树还在修。'),
    ),
  );
}

export function court(): HTMLElement {
  return h('div', { class: 'court-view' },
    panorama(),
    h('section', { class: 'court', 'aria-label': '中庭' },
      ...HALLS.map(hallTile),
      h('div', { class: 'gate' },
        h('span', { class: 'plaque small' }, '山门'),
        h('p', {}, '不用注册。出生资料和心愿只存在这台设备上。'),
        h('a', { class: 'gate-link', href: '#/xiangke' }, '香客簿'),
      ),
    ),
  );
}
