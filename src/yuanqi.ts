// 缘起 (spec story 67): where everything on this site comes from and under which licence. Books and the life guide's
// source are read from the Skill itself (classical_search --list-books, each book's first passage for its licence,
// life_guide --sections); the vendored packages come from manifest.json, written by the build from their METADATA.
import { table } from './card/card';
import { h } from './dom';
import { runJson, type SkillManifest } from './skill/session';

interface Book {
  id: string;
  title: string;
  edition: string;
  source_url: string;
  revision: string;
}

interface Licence {
  original?: string;
  transcription?: string;
  attribution?: string;
}

interface LifeSource {
  source: { attribution: string; license: string; license_url: string; commit: string; snapshot_date: string; changes: string };
}

const SITE_REPO = 'https://github.com/ShousenZHANG/chinese-fortune-temple';

const link = (href: string, text: string) => h('a', { href, rel: 'noopener', target: '_blank' }, text);
const section = (title: string, ...body: (Node | null)[]) =>
  h('section', { class: 'yuanqi-part', 'aria-label': title }, h('h3', { class: 'section-title' }, title), ...body);

async function licence(book: Book): Promise<Licence | null> {
  try {
    const found = await runJson<{ results: { license?: Licence }[] }>({ script: 'classical_search.py',
      argv: ['--passage-id', `${book.id}:c001:p0001`] });
    return found.results[0]?.license ?? null;
  } catch {
    return null;
  }
}

async function booksTable(): Promise<HTMLElement> {
  const { books } = await runJson<{ books: Book[] }>({ script: 'classical_search.py', argv: ['--list-books'] });
  const licences = await Promise.all(books.map(licence));
  return table(['书名', '版本', '来源', '原文', '转录与署名'], books.map((book, i) => [
    `《${book.title}》`, book.edition, `${new URL(book.source_url).host}（${book.revision.startsWith('sha256:') ? '内容哈希锁定' : `revision ${book.revision}`}）`,
    licences[i]?.original ?? '见 Skill 来源说明', [licences[i]?.transcription, licences[i]?.attribution].filter(Boolean).join('；'),
  ]), '随包古籍');
}

async function lifeSource(): Promise<HTMLElement> {
  const { source } = await runJson<LifeSource>({ skill: 'life-guide', script: 'life_guide.py', argv: ['--sections'] });
  return h('div', { 'data-testid': 'life-source' },
    h('p', {}, `${source.attribution}。冻结在提交 ${source.commit.slice(0, 8)}（${source.snapshot_date}），正文按 ${source.license} 使用。`,
      link(source.license_url, '许可原文')),
    h('p', { class: 'note' }, source.changes));
}

function fill(slot: HTMLElement, work: Promise<HTMLElement>, waiting: string): HTMLElement {
  slot.replaceChildren(h('p', { class: 'status' }, waiting));
  work.then((node) => slot.replaceChildren(node))
    .catch(() => slot.replaceChildren(h('p', { class: 'status error', role: 'alert' }, '算法包没有加载成功，请刷新再试。')));
  return slot;
}

async function runtimes(manifest: SkillManifest): Promise<HTMLElement> {
  let python = '';
  try {
    const lock = await (await fetch(`${import.meta.env.BASE_URL}pyodide/pyodide-lock.json`)).json() as { info: { python: string } };
    python = `，内含 Python ${lock.info.python}（PSF 许可）`;
  } catch {
    // The version line still names Pyodide.
  }
  return h('ul', {},
    h('li', {}, `Pyodide ${__PYODIDE_VERSION__}${python}：在浏览器里运行 Python，MPL-2.0。`),
    ...manifest.vendored.map((pkg) => h('li', {}, `${pkg.name} ${pkg.version}：随 Skill 打包，${pkg.license}。`)));
}

export function yuanqi(): HTMLElement {
  const skill = h('div', { 'data-testid': 'skill-source' }, h('p', { class: 'status' }, '正在读取算法包信息…'));
  const runtimeSlot = h('div', {});
  void fetch(`${import.meta.env.BASE_URL}skill/manifest.json`).then((r) => r.json() as Promise<SkillManifest>).then((manifest) => {
    skill.replaceChildren(
      h('p', {}, `chinese-fortune v${manifest.version}（提交 ${manifest.commit.slice(0, 7)}），MIT 许可。`,
        link(`https://github.com/${manifest.repo}/releases/tag/v${manifest.version}`, '发布页')),
      h('p', { class: 'note' }, '构建时按发布页的 SHA256SUMS 和 CI 来源证明逐项校验，不一致就不上线；问心堂用的 life-guide 取自同一提交，每个文件按 git 哈希核对。'));
    fill(runtimeSlot, runtimes(manifest), '正在读取运行库…');
  }).catch(() => skill.replaceChildren(h('p', { class: 'status error' }, '算法包信息没有读到。')));

  return h('section', { class: 'hall', 'aria-labelledby': 'yuanqi-title' },
    h('a', { class: 'back', href: '#/' }, '回中庭'),
    h('h2', { id: 'yuanqi-title', class: 'hall-title' }, '缘起'),
    h('p', { class: 'lede' }, '这里用到的东西都写在这一页：从哪里来，按什么许可使用。'),
    section('本站', h('p', {}, '页面代码按 MIT 许可开源：', link(SITE_REPO, SITE_REPO.replace('https://', '')), '。')),
    section('算法', skill),
    section('古籍',
      h('p', {}, '古籍按公版的历史原文收录；取自维基文库的转录保留 CC BY-SA 4.0 署名和来源链接；现代译注不收。下表从算法包本身读出。'),
      fill(h('div', {}), booksTable(), '正在列出随包古籍…')),
    section('现实建议', fill(h('div', {}), lifeSource(), '正在读取《高性价比人生指南》的出处…')),
    section('运行库', runtimeSlot),
    section('插画与声音',
      h('p', {}, '插画由 GPT Image 为本站生成，经本站的 scripts/art.py 裁切、抠图和压缩；声音由浏览器现场合成，没有录音素材；文字用访客设备自带的字体。')),
  );
}
