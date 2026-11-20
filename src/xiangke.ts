// 香客簿 page: the people kept on this device, a form to add or change one, and the backup file in and out.
// Clearing and deleting ask once more in place, since nothing here can be recovered without an exported file.
import { h } from './dom';
import { download } from './download';
import { cities, cityFacts, type City } from './records/cities';
import { describeBirth, genderName, InvalidRecord, NAME_MAX, parsePilgrim, type Pilgrim } from './records/pilgrim';
import { clearAll, deletePilgrim, exportBackup, importBackup, listPilgrims, parseBackup, savePilgrim }
  from './records/store';

type Notice = { kind: 'alert' | 'status'; text: string } | null;

const today = () => new Date().toISOString().slice(0, 10);

function numberField(label: string, id: string, max: number) {
  const input = h('input', { id, type: 'number', inputmode: 'numeric', min: '1', max: String(max) });
  return { input, field: h('label', { class: 'unit' }, input, label) };
}

export function xiangke(): HTMLElement {
  let table = new Map<string, City>();
  let editing: Pilgrim | null = null;
  const known = (name: string) => table.has(name);

  const list = h('ol', { class: 'pilgrims', 'aria-label': '已录的香客' });
  const formNotice = h('div', { class: 'notice' });
  const backupNotice = h('div', { class: 'notice' });

  const name = h('input', { id: 'pilgrim-name', type: 'text', maxlength: String(NAME_MAX), autocomplete: 'off' });
  const radio = (group: string, value: string, label: string, checked = false) =>
    h('label', { class: 'choice' }, h('input', { type: 'radio', name: group, value, ...(checked ? { checked: true } : {}) }), label);
  const genders = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '性别' },
    radio('gender', 'male', '男'), radio('gender', 'female', '女'));
  const leap = h('input', { id: 'pilgrim-leap', type: 'checkbox' });
  const leapField = h('label', { class: 'choice', hidden: true }, leap, '闰月');
  const calendars = h('div', { class: 'row', role: 'radiogroup', 'aria-label': '历法' },
    radio('calendar', 'solar', '公历', true), radio('calendar', 'lunar', '农历'), leapField);
  const year = numberField('年', 'pilgrim-year', 2100);
  const month = numberField('月', 'pilgrim-month', 12);
  const day = numberField('日', 'pilgrim-day', 31);
  const time = h('input', { id: 'pilgrim-time', type: 'time' });
  const unknownTime = h('input', { id: 'pilgrim-unknown-time', type: 'checkbox' });
  const city = h('input', { id: 'pilgrim-city', type: 'text', list: 'city-list', autocomplete: 'off' });
  const cityList = h('datalist', { id: 'city-list' });
  const facts = h('p', { class: 'hint', 'data-testid': 'city-facts', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', hidden: true, onclick: () => fill(null) }, '取消');
  const confirmClear = h('div', { class: 'row confirm', hidden: true });

  const checked = (group: string) => form.querySelector<HTMLInputElement>(`input[name="${group}"]:checked`)?.value;

  function notify(where: HTMLElement, notice: Notice) {
    formNotice.replaceChildren();
    backupNotice.replaceChildren();
    if (notice) where.replaceChildren(h('p', { role: notice.kind, class: notice.kind }, notice.text));
  }

  function showCity() {
    const found = table.get(city.value.trim());
    facts.textContent = found ? cityFacts(found) : city.value.trim() ? '城市表里没有这个名字，请从列表里选。' : '';
  }

  function syncCalendar() {
    leapField.hidden = checked('calendar') !== 'lunar';
    if (leapField.hidden) leap.checked = false;
    day.input.max = leapField.hidden ? '31' : '30';
  }

  function fill(person: Pilgrim | null) {
    editing = person;
    name.value = person?.name ?? '';
    form.querySelectorAll<HTMLInputElement>('input[type="radio"]').forEach((input) => {
      input.checked = input.name === 'gender' ? input.value === person?.gender
        : input.value === (person?.date.calendar ?? 'solar');
    });
    leap.checked = person?.date.calendar === 'lunar' && person.date.leap;
    year.input.value = person ? String(person.date.year) : '';
    month.input.value = person ? String(person.date.month) : '';
    day.input.value = person ? String(person.date.day) : '';
    unknownTime.checked = person ? !person.time.known : false;
    time.value = person?.time.known ? `${String(person.time.hour).padStart(2, '0')}:${String(person.time.minute).padStart(2, '0')}` : '';
    time.disabled = unknownTime.checked;
    city.value = person?.city ?? '';
    cancel.hidden = !person;
    heading.textContent = person ? `修改「${person.name}」` : '添一位香客';
    syncCalendar();
    showCity();
  }

  function fromForm(): unknown {
    const [hour, minute] = time.value.split(':').map(Number);
    return {
      id: editing?.id ?? crypto.randomUUID(), addedAt: editing?.addedAt, name: name.value, gender: checked('gender'),
      city: city.value,
      date: { calendar: checked('calendar'), year: Number(year.input.value), month: Number(month.input.value),
        day: Number(day.input.value), leap: leap.checked },
      time: unknownTime.checked ? { known: false } : { known: true, hour, minute },
    };
  }

  async function save(event: Event) {
    event.preventDefault();
    if (!unknownTime.checked && !time.value) {
      notify(formNotice, { kind: 'alert', text: '请填出生时间，或勾选「时辰不知道」。' });
      return;
    }
    let person: Pilgrim;
    try {
      person = parsePilgrim(fromForm(), known);
    } catch (error) {
      if (!(error instanceof InvalidRecord)) throw error;
      notify(formNotice, { kind: 'alert', text: error.message });
      return;
    }
    try {
      await savePilgrim(person);
    } catch {
      notify(formNotice, { kind: 'alert', text: '没能存进这台设备的浏览器，请检查是否关闭了网站数据存储。' });
      return;
    }
    notify(formNotice, { kind: 'status', text: `已存下「${person.name}」。` });
    fill(null);
    await render();
  }

  function row(person: Pilgrim): HTMLElement {
    const remove = h('button', { type: 'button', class: 'chip' }, '删除');
    remove.addEventListener('click', async () => {
      if (remove.textContent === '删除') {
        remove.textContent = `确认删除「${person.name}」`;
        return;
      }
      await deletePilgrim(person.id);
      if (editing?.id === person.id) fill(null);
      await render();
    });
    return h('li', { 'data-testid': 'pilgrim' },
      h('span', { class: 'who' }, h('strong', {}, person.name), ` ${genderName(person.gender)}`),
      h('span', { class: 'birth' }, describeBirth(person)),
      h('span', { class: 'row' }, h('button', { type: 'button', class: 'chip', onclick: () => fill(person) }, '修改'), remove),
    );
  }

  async function render() {
    const people = await listPilgrims();
    list.replaceChildren(...(people.length ? people.map(row)
      : [h('li', { class: 'empty', 'data-testid': 'pilgrim-empty' }, '还没有人。先把自己录进来，各殿就能直接选。')]));
    clearButton.disabled = !people.length;
    exportButton.disabled = !people.length;
    confirmClear.hidden = true;
  }

  async function exportFile() {
    const backup = await exportBackup();
    download(`有据山寺-香客簿-${today()}.json`, `${JSON.stringify(backup, null, 2)}\n`, 'application/json');
    notify(backupNotice, { kind: 'status', text: `导出了 ${backup.pilgrims.length} 位香客${backup.wishes.length ? `和 ${backup.wishes.length} 个愿望` : ''}。文件里有出生资料和心愿原文，请自己保管好。` });
  }

  async function importFile() {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text(), known);
      await importBackup(backup);
      await render();
      notify(backupNotice, { kind: 'status', text: `导入了 ${backup.pilgrims.length} 位香客${backup.wishes.length ? `和 ${backup.wishes.length} 个愿望` : ''}。` });
    } catch (error) {
      notify(backupNotice, { kind: 'alert', text: error instanceof InvalidRecord ? `没有导入：${error.message}` : '没有导入：读不了这个文件。' });
    }
  }

  async function clearEverything() {
    await clearAll();
    fill(null);
    await render();
    notify(backupNotice, { kind: 'status', text: '香客簿和愿望簿已清空。' });
  }

  const heading = h('h3', { class: 'section-title' }, '添一位香客');
  const form = h('form', { class: 'pilgrim-form', novalidate: true, onsubmit: (event) => void save(event) },
    heading,
    h('div', { class: 'step' }, h('label', { for: 'pilgrim-name' }, '称呼'), name,
      h('p', { class: 'hint' }, '自己、伴侣、家人都可以，写一个你认得出的称呼。')),
    h('fieldset', { class: 'step' }, h('legend', {}, '性别'), genders),
    h('fieldset', { class: 'step' }, h('legend', {}, '出生日期'), calendars,
      h('div', { class: 'row' }, year.field, month.field, day.field),
      h('p', { class: 'hint' }, '没有特别说明就按公历算，结果里会写明「按公历算」。')),
    h('div', { class: 'step' }, h('label', { for: 'pilgrim-time' }, '出生时间'),
      h('div', { class: 'row' }, time, h('label', { class: 'choice' }, unknownTime, '时辰不知道')),
      h('p', { class: 'hint' }, '时辰不知道的人，各殿只说能确定的部分；紫微斗数要有时辰才能排。')),
    h('div', { class: 'step' }, h('label', { for: 'pilgrim-city' }, '出生地'), city, cityList, facts),
    formNotice,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, '存下'), cancel),
  );

  const exportButton = h('button', { type: 'button', onclick: () => void exportFile() }, '导出成文件');
  const picker = h('input', { id: 'backup-file', type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
  const clearButton = h('button', { type: 'button', onclick: () => { confirmClear.hidden = false; } }, '清除全部');
  confirmClear.append(h('p', {}, '香客簿里的人和愿望簿里的愿都会从这台设备删掉，没有导出过就找不回来。'),
    h('button', { type: 'button', class: 'primary', onclick: () => void clearEverything() }, '确认清除'),
    h('button', { type: 'button', onclick: () => { confirmClear.hidden = true; } }, '不清除'));

  form.addEventListener('change', syncCalendar);
  unknownTime.addEventListener('change', () => { time.disabled = unknownTime.checked; });
  city.addEventListener('input', showCity);
  picker.addEventListener('change', () => void importFile());

  void cities().then((loaded) => {
    table = loaded;
    cityList.replaceChildren(...[...loaded.values()].map((c) => h('option', { value: c.name }, c.province)));
    showCity();
  }).catch(() => { facts.textContent = '城市表没有加载成功，请刷新页面再试。'; });
  void render();

  return h('section', { class: 'hall', 'aria-labelledby': 'xiangke-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('h2', { id: 'xiangke-title', class: 'hall-title' }, '香客簿'),
    h('p', { class: 'lede' }, '出生资料只存在这台设备的浏览器里，不会上传。录一次，各殿直接选人。'),
    list,
    form,
    h('section', { class: 'backup', 'aria-label': '备份与清除' },
      h('h3', { class: 'section-title' }, '备份与清除'),
      h('p', { class: 'hint' }, '香客簿和愿望簿一起导出成一个文件；换设备时到新设备再导入。同一个人、同一个愿不会重复。'),
      h('div', { class: 'row' }, exportButton, h('label', { class: 'file-button', for: 'backup-file' }, '从文件导入'), picker,
        clearButton),
      confirmClear,
      backupNotice,
    ),
  );
}
