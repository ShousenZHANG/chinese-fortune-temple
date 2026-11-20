// Hands the visitor a file made in this page; nothing is uploaded.
import { h } from './dom';

export function download(name: string, content: string | Blob, type: string): void {
  const url = URL.createObjectURL(content instanceof Blob ? content : new Blob([content], { type }));
  const link = h('a', { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
