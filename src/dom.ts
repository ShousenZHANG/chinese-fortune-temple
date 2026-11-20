// Builds elements from tool output without innerHTML, so text from the Skill is always shown as text.
export type Child = Node | string | false | null | undefined;
type Value = string | boolean | undefined | ((event: Event) => void);

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, props: Record<string, Value> = {}, ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === 'function') element.addEventListener(key.slice(2), value);
    else if (value === true) element.setAttribute(key, '');
    else if (typeof value === 'string') element.setAttribute(key, value);
  }
  for (const child of children) if (child) element.append(child);
  return element;
}
