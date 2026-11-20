// The visitor confirms the time zone once (spec story 16); every hall that needs "now" shows this step until then.
import { h } from './dom';
import { confirmedTimezone, confirmTimezone, guessedTimezone, localMoment, timezones } from './moment';

export interface ZoneStep {
  element: HTMLElement;
  /** The confirmed zone, or null while the visitor has not confirmed one. */
  zone(): string | null;
}

export function zoneStep(purpose: string, onConfirm: (zone: string) => void): ZoneStep {
  let timezone = confirmedTimezone();
  const moment = h('p', { 'data-testid': 'cast-moment' });
  const actions = h('div', { class: 'row' });

  function picker(current: string) {
    const select = h('select', { id: 'timezone' },
      ...timezones().map((zone) => h('option', { value: zone, ...(zone === current ? { selected: true } : {}) }, zone)));
    select.addEventListener('change', () => choose(select.value));
    return select;
  }

  function show() {
    const zone = timezone ?? guessedTimezone();
    const now = localMoment(zone);
    moment.textContent = `按 ${zone} 的时间${purpose}，现在是 ${now.date} ${now.time}。`;
    actions.replaceChildren(...(timezone ? [] : [h('button', { type: 'button', onclick: () => choose(zone) }, '就按这个时区')]),
      h('label', { class: 'zone-pick' }, '换一个时区 ', picker(zone)));
  }

  function choose(zone: string) {
    timezone = zone;
    confirmTimezone(zone);
    show();
    onConfirm(zone);
  }

  show();
  return { element: h('div', { class: 'step' }, moment, actions), zone: () => timezone };
}
