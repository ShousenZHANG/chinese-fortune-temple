// 缘起 (spec story 67): where everything on this site comes from and under which licence. Books and the life guide's
// source are read from the Skill itself (classical_search --list-books, each book's first passage for its licence,
// life_guide --sections); the vendored packages come from manifest.json, written by the build from their METADATA.
import { table } from './card/card';
import { h } from './dom';
import { tr } from './i18n';
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
  return table([tr('书名', 'Book'), tr('版本', 'Edition'), tr('来源', 'Source'), tr('原文', 'Original text'), tr('转录与署名', 'Transcription and attribution')], books.map((book, i) => [
    `《${book.title}》`, book.edition, `${new URL(book.source_url).host}（${book.revision.startsWith('sha256:') ? tr('内容哈希锁定', 'pinned by content hash') : `revision ${book.revision}`}）`,
    licences[i]?.original ?? tr('见 Skill 来源说明', 'See the Skill’s source notes'), [licences[i]?.transcription, licences[i]?.attribution].filter(Boolean).join('；'),
  ]), tr('随包古籍', 'Bundled classics'));
}

async function lifeSource(): Promise<HTMLElement> {
  const { source } = await runJson<LifeSource>({ skill: 'life-guide', script: 'life_guide.py', argv: ['--sections'] });
  return h('div', { 'data-testid': 'life-source' },
    h('p', {}, tr(`${source.attribution}。冻结在提交 ${source.commit.slice(0, 8)}（${source.snapshot_date}），正文按 ${source.license} 使用。`,
      `${source.attribution}. Frozen at commit ${source.commit.slice(0, 8)} (${source.snapshot_date}); text used under ${source.license}. `),
      link(source.license_url, tr('许可原文', 'Licence text'))),
    h('p', { class: 'note' }, source.changes));
}

function fill(slot: HTMLElement, work: Promise<HTMLElement>, waiting: string): HTMLElement {
  slot.replaceChildren(h('p', { class: 'status' }, waiting));
  work.then((node) => slot.replaceChildren(node))
    .catch(() => slot.replaceChildren(h('p', { class: 'status error', role: 'alert' }, tr('算法包没有加载成功，请刷新再试。', 'The Skill did not load. Please refresh the page.'))));
  return slot;
}

async function runtimes(manifest: SkillManifest): Promise<HTMLElement> {
  let python = '';
  try {
    const lock = await (await fetch(`${import.meta.env.BASE_URL}pyodide/pyodide-lock.json`)).json() as { info: { python: string } };
    python = tr(`，内含 Python ${lock.info.python}（PSF 许可）`, `, with Python ${lock.info.python} (PSF licence)`);
  } catch {
    // The version line still names Pyodide.
  }
  return h('ul', {},
    h('li', {}, tr(`Pyodide ${__PYODIDE_VERSION__}${python}：在浏览器里运行 Python，MPL-2.0。`, `Pyodide ${__PYODIDE_VERSION__}${python}: runs Python in the browser, MPL-2.0.`)),
    ...manifest.vendored.map((pkg) => h('li', {}, tr(`${pkg.name} ${pkg.version}：随 Skill 打包，${pkg.license}。`, `${pkg.name} ${pkg.version}: bundled with the Skill, ${pkg.license}.`))));
}

export function yuanqi(): HTMLElement {
  const skill = h('div', { 'data-testid': 'skill-source' }, h('p', { class: 'status' }, tr('正在读取算法包信息…', 'Reading the Skill package details…')));
  const runtimeSlot = h('div', {});
  void fetch(`${import.meta.env.BASE_URL}skill/manifest.json`).then((r) => r.json() as Promise<SkillManifest>).then((manifest) => {
    skill.replaceChildren(
      h('p', {}, tr(`chinese-fortune v${manifest.version}（提交 ${manifest.commit.slice(0, 7)}），MIT 许可。`, `chinese-fortune v${manifest.version} (commit ${manifest.commit.slice(0, 7)}), MIT licence. `),
        link(`https://github.com/${manifest.repo}/releases/tag/v${manifest.version}`, tr('发布页', 'Release page'))),
      h('p', { class: 'note' }, tr('构建时按发布页的 SHA256SUMS 和 CI 来源证明逐项校验，不一致就不上线；问心堂用的 life-guide 取自同一提交，每个文件按 git 哈希核对。', 'The build checks the release against its SHA256SUMS and CI provenance and refuses to ship on any mismatch; the life-guide used by the Hall of Questions comes from the same commit, each file checked against its git hash.')));
    fill(runtimeSlot, runtimes(manifest), tr('正在读取运行库…', 'Reading the runtimes…'));
  }).catch(() => skill.replaceChildren(h('p', { class: 'status error' }, tr('算法包信息没有读到。', 'The Skill package details could not be read.'))));

  return h('section', { class: 'hall', 'aria-labelledby': 'yuanqi-title' },
    h('a', { class: 'back', href: '#/' }, tr('回中庭', 'Back to the courtyard')),
    h('h2', { id: 'yuanqi-title', class: 'hall-title' }, tr('缘起', 'Sources')),
    h('p', { class: 'lede' }, tr('这里用到的东西都写在这一页：从哪里来，按什么许可使用。', 'Everything this site uses, where it comes from and under which licence.')),
    section(tr('本站', 'This site'), h('p', {}, tr('页面代码按 MIT 许可开源：', 'The page code is open source under MIT: '), link(SITE_REPO, SITE_REPO.replace('https://', '')), '。')),
    section(tr('算法', 'The Skill'), skill),
    section(tr('古籍', 'Classics'),
      h('p', {}, tr('古籍按公版的历史原文收录；取自维基文库的转录保留 CC BY-SA 4.0 署名和来源链接；现代译注不收。下表从算法包本身读出。', 'The classics are public-domain historical texts; transcriptions from Wikisource keep their CC BY-SA 4.0 attribution and source links; modern commentary is left out. The table is read from the Skill package itself.')),
      fill(h('div', {}), booksTable(), tr('正在列出随包古籍…', 'Listing the bundled classics…'))),
    section(tr('现实建议', 'Practical advice'), fill(h('div', {}), lifeSource(), tr('正在读取《高性价比人生指南》的出处…', 'Reading the source of the 高性价比人生指南…'))),
    section(tr('运行库', 'Runtimes'), runtimeSlot),
    section(tr('插画与声音', 'Pictures and sound'),
      h('p', {}, tr('插画由 GPT Image 为本站生成，经本站的 scripts/art.py 裁切、抠图和压缩；声音由浏览器现场合成，没有录音素材；文字用访客设备自带的字体。', 'The pictures were made for this site with GPT Image and cropped, cut out and compressed by its scripts/art.py; sounds are synthesised in the browser from no recordings; text uses the fonts on your device.'))),
  );
}
