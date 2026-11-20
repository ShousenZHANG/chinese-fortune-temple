// A drop-down of 香客簿 people, labelled by a separate <label> so the label text stays exact.
import { h } from '../dom';
import { genderName, type Pilgrim } from './pilgrim';

export function pilgrimPicker(id: string, label: string, people: Pilgrim[], selected = 0) {
  const select = h('select', { id },
    ...people.map((p, i) => h('option', { value: p.id, ...(i === selected ? { selected: true } : {}) },
      `${p.name}（${genderName(p.gender)}）`)));
  const pick = (): Pilgrim => people.find((p) => p.id === select.value) ?? people[0];
  return { select, pick, field: h('span', { class: 'zone-pick' }, h('label', { for: id }, label), select) };
}
