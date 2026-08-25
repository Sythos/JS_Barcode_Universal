import { readFile } from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = resolve(root, 'docs');
const failures = [];

function collectMarkdown(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectMarkdown(absolute));
    else if (entry.isFile() && extname(entry.name).toLowerCase() === '.md') files.push(absolute);
  }
  return files;
}

function reportFailure(message) {
  failures.push(message);
}

const markdownFiles = collectMarkdown(docsRoot);
for (const file of markdownFiles) {
  const text = await readFile(file, 'utf8');
  if (/OpenAI|ChatGPT|Codex/u.test(text)) {
    reportFailure(`${relative(root, file)} contains forbidden attribution text`);
  }
  if (/[àèìòùÀÈÌÒÙ]/u.test(text)) {
    reportFailure(`${relative(root, file)} contains Italian prose`);
  }
  if (/[ \t]+$/mu.test(text)) {
    reportFailure(`${relative(root, file)} contains trailing whitespace`);
  }

  const linkPattern = /\[[^\]]+\]\(([^)\s]+)(?:\s+["'][^)]*)?\)/gu;
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1];
    if (/^(?:https?:\/\/|mailto:|#)/u.test(target)) continue;
    const pathPart = target.split('#', 1)[0].split('?', 1)[0];
    if (!pathPart) continue;
    const candidate = resolve(dirname(file), decodeURIComponent(pathPart));
    if (!existsSync(candidate)) {
      reportFailure(`${relative(root, file)} links to missing ${target}`);
    }
  }
}

const mkdocs = await readFile(resolve(root, 'mkdocs.yml'), 'utf8');
const navTargets = [...mkdocs.matchAll(/^\s*-\s+[^:\n]+:\s+([^\s#]+)$/gmu)]
  .map((match) => match[1])
  .filter((target) => /\.(?:md|html)$/u.test(target));
for (const target of navTargets) {
  if (!existsSync(resolve(docsRoot, target))) {
    reportFailure(`mkdocs.yml navigation target is missing: ${target}`);
  }
}

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const { listFormats } = await import(pathToFileURL(resolve(root, 'src/index.js')).href);
const formats = listFormats();
const writable = formats.filter((format) => format.canWrite).length;
const readable = formats.filter((format) => format.canRead).length;
const overview = await readFile(resolve(docsRoot, 'formats/overview.md'), 'utf8');
if (!overview.includes(`**${formats.length} entries**`)) {
  reportFailure('docs/formats/overview.md has a stale registry entry count');
}
if (!new RegExp(`all ${writable} are writable and\\s+${readable} are readable`, 'u').test(overview)) {
  reportFailure('docs/formats/overview.md has stale read/write capability counts');
}
for (const format of formats) {
  if (!overview.includes(`\`${format.id}\``)) {
    reportFailure(`docs/formats/overview.md is missing runtime format ${format.id}`);
  }
}

const readme = await readFile(resolve(root, 'README.md'), 'utf8');
const llms = await readFile(resolve(root, 'llms.txt'), 'utf8');
const pagesUrl = 'https://sythos.github.io/JS_Barcode_Universal/';
if (!readme.includes(`current release is \`${packageJson.version}\``)) {
  reportFailure('README.md does not expose the package version consistently');
}
if (!llms.includes(`Current repository release: \`${packageJson.version}\``)) {
  reportFailure('llms.txt does not expose the package version consistently');
}
if (!readme.includes(pagesUrl)) reportFailure('README.md is missing the canonical Pages URL');
if (!llms.includes(pagesUrl)) reportFailure('llms.txt is missing the canonical Pages URL');
if (packageJson.homepage !== pagesUrl) reportFailure('package.json homepage is not the canonical Pages URL');
const index = await readFile(resolve(docsRoot, 'index.md'), 'utf8');
if (!/\*\*M6:\*\*[^\n]*complete/u.test(index)) {
  reportFailure('docs/index.md does not mark M6 complete');
}
for (const target of [
  'examples/create-barcode.md',
  'examples/read-barcode.md',
  'examples/camera-loop.md',
  'examples/typescript-project.md',
  'faq.md',
  'troubleshooting.md',
]) {
  if (!navTargets.includes(target)) reportFailure(`mkdocs.yml is missing M6 page ${target}`);
}

if (failures.length > 0) {
  console.error(failures.map((failure) => `- ${failure}`).join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Documentation checks passed: ${markdownFiles.length} Markdown files, ` +
      `${navTargets.length} navigation targets, ${formats.length} registry formats.`,
  );
}
