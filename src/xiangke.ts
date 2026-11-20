// 香客簿 page: the people kept on this device, a form to add or change one, and the backup file in and out.
// Clearing and deleting ask once more in place, since nothing here can be recovered without an exported file.
import { h } from './dom';
import { tr } from './i18n';
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

  const list = h('ol', { class: 'pilgrims', 'aria-label': tr('已录的香客', 'People recorded') });
  const formNotice = h('div', { class: 'notice' });
  const backupNotice = h('div', { class: 'notice' });

  const name = h('input', { id: 'pilgrim-name', type: 'text', maxlength: String(NAME_MAX), autocomplete: 'off' });
  const radio = (group: string, value: string, label: string, checked = false) =>
    h('label', { class: 'choice' }, h('input', { type: 'radio', name: group, value, ...(checked ? { checked: true } : {}) }), label);
  const genders = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('性别', 'Sex') },
    radio('gender', 'male', tr('男', 'Male')), radio('gender', 'female', tr('女', 'Female')));
  const leap = h('input', { id: 'pilgrim-leap', type: 'checkbox' });
  const leapField = h('label', { class: 'choice', hidden: true }, leap, tr('闰月', 'Leap month'));
  const calendars = h('div', { class: 'row', role: 'radiogroup', 'aria-label': tr('历法', 'Calendar') },
    radio('calendar', 'solar', tr('公历', 'Gregorian'), true), radio('calendar', 'lunar', tr('农历', 'Chinese lunar')), leapField);
  const year = numberField(tr('年', 'Year'), 'pilgrim-year', 2100);
  const month = numberField(tr('月', 'Month'), 'pilgrim-month', 12);
  const day = numberField(tr('日', 'Day'), 'pilgrim-day', 31);
  const time = h('input', { id: 'pilgrim-time', type: 'time' });
  const unknownTime = h('input', { id: 'pilgrim-unknown-time', type: 'checkbox' });
  const city = h('input', { id: 'pilgrim-city', type: 'text', list: 'city-list', autocomplete: 'off' });
  const cityList = h('datalist', { id: 'city-list' });
  const facts = h('p', { class: 'hint', 'data-testid': 'city-facts', 'aria-live': 'polite' });
  const cancel = h('button', { type: 'button', hidden: true, onclick: () => fill(null) }, tr('取消', 'Cancel'));
  const confirmClear = h('div', { class: 'row confirm', hidden: true });

  const checked = (group: string) => form.querySelector<HTMLInputElement>(`input[name="${group}"]:checked`)?.value;

  function notify(where: HTMLElement, notice: Notice) {
    formNotice.replaceChildren();
    backupNotice.replaceChildren();
    if (notice) where.replaceChildren(h('p', { role: notice.kind, class: notice.kind }, notice.text));
  }

  function showCity() {
    const found = table.get(city.value.trim());
    facts.textContent = found ? cityFacts(found) : city.value.trim() ? tr('城市表里没有这个名字，请从列表里选。', 'That name is not in the city table; choose from the list.') : '';
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
    heading.textContent = person ? tr(`修改「${person.name}」`, `Edit ${person.name}`) : tr('添一位香客', 'Add a person');
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
      notify(formNotice, { kind: 'alert', text: tr('请填出生时间，或勾选「时辰不知道」。', 'Enter the birth time, or tick Hour unknown.') });
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
      notify(formNotice, { kind: 'alert', text: tr('没能存进这台设备的浏览器，请检查是否关闭了网站数据存储。', 'Could not save in this browser. Check whether site data storage is turned off.') });
      return;
    }
    notify(formNotice, { kind: 'status', text: tr(`已存下「${person.name}」。`, `Saved ${person.name}.`) });
    fill(null);
    await render();
  }

  function row(person: Pilgrim): HTMLElement {
    const remove = h('button', { type: 'button', class: 'chip' }, tr('删除', 'Delete'));
    remove.addEventListener('click', async () => {
      if (remove.textContent === tr('删除', 'Delete')) {
        remove.textContent = tr(`确认删除「${person.name}」`, `Delete ${person.name} now`);
        return;
      }
      await deletePilgrim(person.id);
      if (editing?.id === person.id) fill(null);
      await render();
    });
    return h('li', { 'data-testid': 'pilgrim' },
      h('span', { class: 'who' }, h('strong', {}, person.name), ` ${genderName(person.gender)}`),
      h('span', { class: 'birth' }, describeBirth(person)),
      h('span', { class: 'row' }, h('button', { type: 'button', class: 'chip', onclick: () => fill(person) }, tr('修改', 'Edit')), remove),
    );
  }

  async function render() {
    const people = await listPilgrims();
    list.replaceChildren(...(people.length ? people.map(row)
      : [h('li', { class: 'empty', 'data-testid': 'pilgrim-empty' }, tr('还没有人。先把自己录进来，各殿就能直接选。', 'Nobody yet. Add yourself first, and every hall can pick you directly.'))]));
    clearButton.disabled = !people.length;
    exportButton.disabled = !people.length;
    confirmClear.hidden = true;
  }

  async function exportFile() {
    const backup = await exportBackup();
    download(`有据山寺-香客簿-${today()}.json`, `${JSON.stringify(backup, null, 2)}\n`, 'application/json');
    notify(backupNotice, { kind: 'status', text: tr(`导出了 ${backup.pilgrims.length} 位香客${backup.wishes.length ? `和 ${backup.wishes.length} 个愿望` : ''}。文件里有出生资料和心愿原文，请自己保管好。`,
      `Exported ${backup.pilgrims.length} people${backup.wishes.length ? ` and ${backup.wishes.length} wishes` : ''}. The file holds birth details and wishes; keep it safe.`) });
  }

  async function importFile() {
    const file = picker.files?.[0];
    picker.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text(), known);
      await importBackup(backup);
      await render();
      notify(backupNotice, { kind: 'status', text: tr(`导入了 ${backup.pilgrims.length} 位香客${backup.wishes.length ? `和 ${backup.wishes.length} 个愿望` : ''}。`,
        `Imported ${backup.pilgrims.length} people${backup.wishes.length ? ` and ${backup.wishes.length} wishes` : ''}.`) });
    } catch (error) {
      notify(backupNotice, { kind: 'alert', text: error instanceof InvalidRecord ? `${tr('没有导入：', 'Not imported: ')}${error.message}` : tr('没有导入：读不了这个文件。', 'Not imported: the file cannot be read.') });
    }
  }

  async function clearEverything() {
    await clearAll();
    fill(null);
    await render();
    notify(backupNotice, { kind: 'status', text: tr('香客簿和愿望簿已清空。', 'The Pilgrim Book and Wish Book are now empty.') });
  }

  const heading = h('h3', { class: 'section-title' }, tr('添一位香客', 'Add a person'));
  const form = h('form', { class: 'pilgrim-form', novalidate: true, onsubmit: (event) => void save(event) },
    heading,
    h('div', { class: 'step' }, h('label', { for: 'pilgrim-name' }, tr('称呼', 'Name')), name,
      h('p', { class: 'hint' }, tr('自己、伴侣、家人都可以，写一个你认得出的称呼。', 'Yourself, a partner or family: any name you will recognise.'))),
    h('fieldset', { class: 'step' }, h('legend', {}, tr('性别', 'Sex')), genders),
    h('fieldset', { class: 'step' }, h('legend', {}, tr('出生日期', 'Birth date')), calendars,
      h('div', { class: 'row' }, year.field, month.field, day.field),
      h('p', { class: 'hint' }, tr('没有特别说明就按公历算，结果里会写明「按公历算」。', 'Dates are read as Gregorian unless you choose Chinese lunar; results say which.'))),
    h('div', { class: 'step' }, h('label', { for: 'pilgrim-time' }, tr('出生时间', 'Birth time')),
      h('div', { class: 'row' }, time, h('label', { class: 'choice' }, unknownTime, tr('时辰不知道', 'Hour unknown'))),
      h('p', { class: 'hint' }, tr('时辰不知道的人，各殿只说能确定的部分；紫微斗数要有时辰才能排。', 'Without the hour, each hall says only what it can settle; a Zi Wei chart needs the hour.'))),
    h('div', { class: 'step' }, h('label', { for: 'pilgrim-city' }, tr('出生地', 'Birthplace')), city, cityList, facts),
    formNotice,
    h('div', { class: 'row' }, h('button', { type: 'submit', class: 'primary' }, tr('存下', 'Save')), cancel),
  );

  const exportButton = h('button', { type: 'button', onclick: () => void exportFile() }, tr('导出成文件', 'Export to a file'));
  const picker = h('input', { id: 'backup-file', type: 'file', accept: '.json,application/json', class: 'visually-hidden' });
  const clearButton = h('button', { type: 'button', onclick: () => { confirmClear.hidden = false; } }, tr('清除全部', 'Clear everything'));
  confirmClear.append(h('p', {}, tr('香客簿里的人和愿望簿里的愿都会从这台设备删掉，没有导出过就找不回来。', 'Everyone in the Pilgrim Book and every wish will be deleted from this device. Without an export they cannot be recovered.')),
    h('button', { type: 'button', class: 'primary', onclick: () => void clearEverything() }, tr('确认清除', 'Clear now')),
    h('button', { type: 'button', onclick: () => { confirmClear.hidden = true; } }, tr('不清除', 'Keep everything')));

  form.addEventListener('change', syncCalendar);
  unknownTime.addEventListener('change', () => { time.disabled = unknownTime.checked; });
  city.addEventListener('input', showCity);
  picker.addEventListener('change', () => void importFile());

  void cities().then((loaded) => {
    table = loaded;
    cityList.replaceChildren(...[...loaded.values()].map((c) => h('option', { value: c.name }, c.province)));
    showCity();
  }).catch(() => { facts.textContent = tr('城市表没有加载成功，请刷新页面再试。', 'The city table did not load. Please refresh the page.'); });
  void render();

  return h('section', { class: 'hall', 'aria-labelledby': 'xiangke-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('h2', { id: 'xiangke-title', class: 'hall-title' }, tr('香客簿', 'Pilgrim Book')),
    h('p', { class: 'lede' }, tr('出生资料只存在这台设备的浏览器里，不会上传。录一次，各殿直接选人。', 'Birth details stay in this browser and are never uploaded. Enter them once and every hall can use them.')),
    list,
    form,
    h('section', { class: 'backup', 'aria-label': tr('备份与清除', 'Backup and clearing') },
      h('h3', { class: 'section-title' }, tr('备份与清除', 'Backup and clearing')),
      h('p', { class: 'hint' }, tr('香客簿和愿望簿一起导出成一个文件；换设备时到新设备再导入。同一个人、同一个愿不会重复。', 'The Pilgrim Book and Wish Book export together as one file; import it on the new device. Nobody and no wish is duplicated.')),
      h('div', { class: 'row' }, exportButton, h('label', { class: 'file-button', for: 'backup-file' }, tr('从文件导入', 'Import from a file')), picker,
        clearButton),
      confirmClear,
      backupNotice,
    ),
  );
}
