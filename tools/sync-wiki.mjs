import { cp, mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const REPOSITORY_URL = "https://github.com/Sythos/JS_Barcode_Universal";
const PAGES_URL = "https://sythos.github.io/JS_Barcode_Universal/";
const EXCLUDED_DOCUMENTS = new Set([
  "COLOR_PIPELINE_NOTES.md",
  "DOCS_ARCHITECTURE.md",
  "JABCODE_NOTES.md",
]);
const MANIFEST_NAME = ".sythos-wiki-sync.json";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(repositoryRoot, "docs");

function readArgument(name) {
  const argumentIndex = process.argv.indexOf(name);
  return argumentIndex >= 0 ? process.argv[argumentIndex + 1] : undefined;
}

function requiredArgument(name) {
  const value = readArgument(name);
  if (!value) {
    throw new Error(`Missing required argument: ${name}`);
  }
  return path.resolve(value);
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

async function listMarkdownFiles(directory, relativeDirectory = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relativePath = path.join(relativeDirectory, entry.name);
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(absolutePath, relativePath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md") && !EXCLUDED_DOCUMENTS.has(entry.name)) {
      files.push(toPosix(relativePath));
    }
  }

  return files;
}

function resolveDocumentPath(sourceRelativePath, linkPath) {
  const sourceDirectory = path.posix.dirname(sourceRelativePath);
  return path.posix.normalize(path.posix.join(sourceDirectory, linkPath));
}

function documentUrl(documentPath) {
  const normalized = documentPath.replace(/\.md$/i, "");
  if (normalized === "index") {
    return PAGES_URL;
  }
  return new URL(`${normalized.replace(/\\/g, "/")}/`, PAGES_URL).toString();
}

function assetUrl(sourceRelativePath, linkPath) {
  const resolved = resolveDocumentPath(sourceRelativePath, linkPath);
  return new URL(resolved.replace(/\\/g, "/"), PAGES_URL).toString();
}

function rewriteLink(sourceRelativePath, rawTarget) {
  const match = rawTarget.match(/^([^?#]*)([?#].*)?$/);
  if (!match) {
    return rawTarget;
  }

  const [, linkPath, suffix = ""] = match;
  if (
    !linkPath ||
    linkPath.startsWith("#") ||
    linkPath.startsWith("/") ||
    linkPath.startsWith("//") ||
    /^(?:[a-z][a-z\d+.-]*:)/i.test(linkPath)
  ) {
    return rawTarget;
  }

  if (linkPath.toLowerCase().endsWith(".md")) {
    return `${documentUrl(resolveDocumentPath(sourceRelativePath, linkPath))}${suffix}`;
  }

  if (/\.(?:png|jpe?g|gif|svg|webp|avif|ico|txt|json|pdf)$/i.test(linkPath)) {
    return `${assetUrl(sourceRelativePath, linkPath)}${suffix}`;
  }

  return rawTarget;
}

function rewriteMarkdownLinks(sourceRelativePath, markdown) {
  const inlineLinks = /(\[[^\]]*\]\()([^\s)]+)([^)]*\))/g;
  const referenceLinks = /^(\s*\[[^\]]+\]:\s*)(\S+)(.*)$/gm;
  const rewrite = (_match, prefix, target, suffix) =>
    `${prefix}${rewriteLink(sourceRelativePath, target)}${suffix}`;

  return markdown
    .replace(inlineLinks, rewrite)
    .replace(referenceLinks, rewrite);
}

function titleFromPath(relativePath) {
  const name = path.posix.basename(relativePath, ".md");
  if (name === "index") {
    return "Home";
  }
  return name
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function pageUrl(relativePath) {
  const route = relativePath === "index.md" ? "" : relativePath.replace(/\.md$/i, "");
  return new URL(route ? `${route}/` : "", PAGES_URL).toString();
}

function renderSidebar(markdownFiles) {
  const groups = new Map();
  const rootFiles = [];

  for (const relativePath of markdownFiles) {
    if (relativePath === "index.md") {
      continue;
    }

    const [firstSegment] = relativePath.split("/");
    if (!relativePath.includes("/")) {
      rootFiles.push(relativePath);
      continue;
    }

    if (!groups.has(firstSegment)) {
      groups.set(firstSegment, []);
    }
    groups.get(firstSegment).push(relativePath);
  }

  const groupTitles = {
    api: "API reference",
    examples: "Recipes",
    formats: "Barcode formats",
    guides: "Platform guides",
  };
  const lines = [
    "# JS Barcode Universal",
    "",
    `- [Home](${PAGES_URL})`,
    `- [GitHub repository](${REPOSITORY_URL})`,
    "",
  ];

  for (const [group, files] of groups) {
    lines.push(`## ${groupTitles[group] ?? titleFromPath(`${group}.md`)}`);
    for (const relativePath of files.sort()) {
      lines.push(`- [${titleFromPath(relativePath)}](${pageUrl(relativePath)})`);
    }
    lines.push("");
  }

  for (const relativePath of rootFiles.sort()) {
    lines.push(`- [${titleFromPath(relativePath)}](${pageUrl(relativePath)})`);
  }

  lines.push(
    "",
    "---",
    "",
    `This sidebar is generated from the canonical [MkDocs documentation](${PAGES_URL}).`,
    "",
  );
  return `${lines.join("\n").replace(/\n+$/u, "")}\n`;
}

async function main() {
  const mergeDirectoryArgument = readArgument("--merge");
  if (mergeDirectoryArgument) {
    const contentDirectory = requiredArgument("--content");
    await mergeWiki(path.resolve(mergeDirectoryArgument), contentDirectory);
    return;
  }

  const outputDirectory = requiredArgument("--output");
  const relativeOutput = path.relative(repositoryRoot, outputDirectory);
  if (!relativeOutput || (!relativeOutput.startsWith("..") && !path.isAbsolute(relativeOutput))) {
    throw new Error("The Wiki output directory must be outside the repository checkout.");
  }

  const markdownFiles = await listMarkdownFiles(docsRoot);
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  for (const relativePath of markdownFiles) {
    const sourcePath = path.join(docsRoot, relativePath);
    const wikiPath = relativePath === "index.md" ? "Home.md" : relativePath;
    const destinationPath = path.join(outputDirectory, wikiPath);
    const source = await readFile(sourcePath, "utf8");
    let content = rewriteMarkdownLinks(relativePath, source);

    if (relativePath === "index.md") {
      content +=
        `\n\n---\n\n> This Wiki page is generated from the canonical [MkDocs documentation](${PAGES_URL}). ` +
        "Changes made in `docs/` are synchronized here automatically.\n";
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await writeFile(destinationPath, content, "utf8");
  }

  await writeFile(path.join(outputDirectory, "_Sidebar.md"), renderSidebar(markdownFiles), "utf8");
  const generatedFiles = [
    ...markdownFiles.map((relativePath) => (relativePath === "index.md" ? "Home.md" : relativePath)),
    "_Sidebar.md",
  ].sort();
  await writeFile(
    path.join(outputDirectory, MANIFEST_NAME),
    `${JSON.stringify({ version: 1, source: "docs/", files: generatedFiles }, null, 2)}\n`,
    "utf8",
  );
  console.log(`Prepared ${markdownFiles.length} documentation pages plus _Sidebar.md.`);
}

async function mergeWiki(wikiDirectory, contentDirectory) {
  const manifestPath = path.join(contentDirectory, MANIFEST_NAME);
  const contentManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const existingManifestPath = path.join(wikiDirectory, MANIFEST_NAME);
  let existingManifest = { files: [] };

  try {
    existingManifest = JSON.parse(await readFile(existingManifestPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }

  const generatedFiles = new Set(contentManifest.files);
  for (const relativePath of existingManifest.files ?? []) {
    if (!generatedFiles.has(relativePath)) {
      await rm(path.join(wikiDirectory, relativePath), { force: true });
    }
  }

  for (const relativePath of contentManifest.files) {
    const destinationPath = path.join(wikiDirectory, relativePath);
    await mkdir(path.dirname(destinationPath), { recursive: true });
    await cp(path.join(contentDirectory, relativePath), destinationPath, { force: true });
  }

  await cp(manifestPath, existingManifestPath, { force: true });
  console.log(`Merged ${contentManifest.files.length} generated files into the Wiki checkout.`);
}

await main();
