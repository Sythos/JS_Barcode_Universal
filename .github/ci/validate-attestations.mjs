/*!
 * Sythos Barcode Universal
 *
 * MIT License
 *
 * Copyright (c) 2026 Sythos
 * SPDX-License-Identifier: MIT
 *
 * CI-only static validation for GitHub Artifact Attestation workflows.
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REQUIRED_PERMISSIONS = Object.freeze([
  'id-token',
  'attestations',
  'artifact-metadata'
]);

const WORKFLOW_KINDS = Object.freeze([
  'npm',
  'github-packages',
  'release'
]);

const ATTEST_ACTION = 'actions/attest@v4';
const ATTEST_ACTION_PATTERN = /actions\/attest@(?:v4\b|[0-9a-f]{40}\b(?:\s+#\s*v4(?:\.[0-9]+){0,2})?)/iu;

function stripYamlComment(value) {
  let quote = null;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if ((character === "'" || character === '"') && value[index - 1] !== '\\') {
      quote = quote === character ? null : quote || character;
    }
    if (character === '#' && !quote && (index === 0 || /\s/.test(value[index - 1]))) {
      return value.slice(0, index).trimEnd();
    }
  }
  return value.trimEnd();
}

function indentation(line) {
  return line.match(/^\s*/u)?.[0].length ?? 0;
}

function normalizedLines(text) {
  return String(text).replace(/\r\n?/gu, '\n').split('\n');
}

function normalizedValue(value) {
  return stripYamlComment(String(value))
    .trim()
    .replace(/^['"]|['"]$/gu, '')
    .replace(/\\/gu, '/')
    .replace(/^\.\//u, '')
    .replace(/^\$\{\{\s*github\.workspace\s*\}\}\/?/iu, '');
}

function parseInlinePermissions(value) {
  const permissions = new Map();
  const trimmed = stripYamlComment(value).trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return permissions;
  for (const entry of trimmed.slice(1, -1).split(',')) {
    const match = entry.trim().match(/^([A-Za-z0-9_.-]+)\s*:\s*([^,]+)$/u);
    if (match) permissions.set(match[1], normalizedValue(match[2]));
  }
  return permissions;
}

function jobIdAtLine(lines, lineIndex) {
  const jobsIndex = lines.findIndex((line) => /^jobs:\s*$/u.test(stripYamlComment(line.trim())));
  if (jobsIndex < 0 || lineIndex <= jobsIndex) return null;

  let currentJob = null;
  for (let index = jobsIndex + 1; index <= lineIndex; index += 1) {
    const line = stripYamlComment(lines[index]);
    if (!line.trim()) continue;
    if (indentation(line) === 0) break;
    const match = line.match(/^ {2}([A-Za-z0-9_.-]+):\s*$/u);
    if (match) currentJob = match[1];
  }
  return currentJob;
}

function extractPermissionBlocks(lines) {
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = stripYamlComment(lines[index]);
    const match = line.match(/^(\s*)permissions:\s*(.*)$/u);
    if (!match) continue;

    const blockIndent = match[1].length;
    const permissions = parseInlinePermissions(match[2]);
    let end = index;
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const nested = stripYamlComment(lines[cursor]);
      if (!nested.trim()) {
        end = cursor;
        continue;
      }
      if (indentation(nested) <= blockIndent) break;
      end = cursor;
      const entry = nested.match(/^\s{2,}([A-Za-z0-9_.-]+):\s*([^\s#].*?)?\s*$/u);
      if (entry) permissions.set(entry[1], normalizedValue(entry[2] ?? ''));
    }

    blocks.push({
      line: index,
      end,
      indent: blockIndent,
      jobId: blockIndent === 0 ? null : jobIdAtLine(lines, index),
      permissions,
      mode: normalizedValue(match[2])
    });
  }
  return blocks;
}

function hasRequiredPermissions(block) {
  if (!block) return false;
  return REQUIRED_PERMISSIONS.every((permission) => block.permissions.get(permission) === 'write');
}

function findTopLevelPermissionBlock(blocks) {
  return blocks.find((block) => block.indent === 0) ?? null;
}

function findAttestationLineIndexes(lines) {
  return lines.reduce((indexes, line, index) => {
    // Match the raw line so an immutable SHA can retain its `# v4.x` marker.
    // Stripping comments first would make a correctly pinned action look
    // unversioned and would incorrectly reject the workflow.
    if (/\buses:\s*/u.test(line) && ATTEST_ACTION_PATTERN.test(line)) indexes.push(index);
    return indexes;
  }, []);
}

function actionStepBlock(lines, actionLineIndex) {
  const startIndent = indentation(lines[actionLineIndex]);
  const block = [lines[actionLineIndex]];
  for (let index = actionLineIndex + 1; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*-\s/u.test(line) && indentation(line) <= startIndent) break;
    block.push(line);
  }
  return block;
}

function extractSubjectPaths(lines, actionLineIndex) {
  const block = actionStepBlock(lines, actionLineIndex);
  const paths = [];
  for (let index = 0; index < block.length; index += 1) {
    const line = stripYamlComment(block[index]);
    const match = line.match(/^\s*subject-path:\s*(.+)$/u);
    if (match) {
      const value = normalizedValue(match[1]);
      if (value && value !== '|' && value !== '>') paths.push(value);
      for (let cursor = index + 1; (value === '|' || value === '>') && cursor < block.length; cursor += 1) {
        const nested = stripYamlComment(block[cursor]).trim();
        if (!nested || nested.startsWith('-')) continue;
        if (indentation(block[cursor]) <= indentation(block[index])) break;
        paths.push(normalizedValue(nested));
      }
    }
  }
  return paths;
}

function extractArchivePatterns(text) {
  const patterns = new Set();
  for (const line of normalizedLines(text)) {
    const value = stripYamlComment(line);
    if (!/\.tgz\b/u.test(value)) continue;
    const matches = value.match(/(?:[A-Za-z0-9_./${}-]+\*?\.tgz)\b/gu) ?? [];
    for (const match of matches) patterns.add(normalizedValue(match));
  }
  return [...patterns];
}

function archivePatternFromPack(text) {
  const packCommands = normalizedLines(text)
    .map(stripYamlComment)
    .filter((line) => /\bnpm\s+pack\b/u.test(line) && !/\s--dry-run(?:\s|$)/u.test(line));
  if (packCommands.length === 0) return null;

  const command = packCommands[0];
  const destination = command.match(/--pack-destination(?:=|\s+)(["']?)([^\s"']+)\1/u)?.[2];
  if (destination && !/[${}]/u.test(destination)) {
    return `${normalizedValue(destination).replace(/\/$/u, '')}/*.tgz`;
  }
  return '*.tgz';
}

function patternDirectory(pattern) {
  const value = normalizedValue(pattern);
  const separator = value.lastIndexOf('/');
  return separator < 0 ? '' : value.slice(0, separator);
}

function patternsOverlap(left, right) {
  const a = normalizedValue(left);
  const b = normalizedValue(right);
  if (a === b) return true;
  if (a.includes('*') || b.includes('*')) {
    const leftDirectory = patternDirectory(a);
    const rightDirectory = patternDirectory(b);
    return leftDirectory === rightDirectory || !leftDirectory || !rightDirectory;
  }
  if (!a.endsWith('.tgz') || !b.endsWith('.tgz')) return false;
  return patternDirectory(a) === patternDirectory(b);
}

function containsArchiveReference(value, archivePattern) {
  return extractArchivePatterns(value).some((reference) => patternsOverlap(reference, archivePattern));
}

function isDynamicArchiveReference(value) {
  return /\$\{\{\s*steps\.[A-Za-z0-9_-]+\.outputs\.(?:filename|tarball)\s*\}\}/u.test(value);
}

function extractActionReferences(lines, actionPattern, fieldNames) {
  const references = [];
  for (let index = 0; index < lines.length; index += 1) {
    if (!new RegExp(`\\buses:\\s*${actionPattern.replace('/', '\\/')}@`, 'u').test(stripYamlComment(lines[index]))) continue;
    const block = actionStepBlock(lines, index);
    for (const field of fieldNames) {
      for (const line of block) {
        const match = stripYamlComment(line).match(new RegExp(`^\\s*${field}:\\s*(.+)$`, 'u'));
        if (match) references.push(normalizedValue(match[1]));
      }
    }
  }
  return references;
}

function validatePermissions(lines, attestationIndexes, errors) {
  const blocks = extractPermissionBlocks(lines);
  const topLevel = findTopLevelPermissionBlock(blocks);
  if (attestationIndexes.length === 0) {
    errors.push(`missing ${ATTEST_ACTION}`);
    return;
  }

  for (const lineIndex of attestationIndexes) {
    const jobId = jobIdAtLine(lines, lineIndex);
    const jobPermissions = blocks.find((block) => block.jobId === jobId && block.indent > 0);
    const effective = jobPermissions ?? topLevel;
    if (!hasRequiredPermissions(effective)) {
      const location = effective ? `permissions at line ${effective.line + 1}` : 'workflow/job permissions';
      errors.push(`${ATTEST_ACTION} requires id-token: write, attestations: write and artifact-metadata: write (${location})`);
    }
  }
}

function validateSubjects(lines, archivePattern, errors) {
  const attestIndexes = findAttestationLineIndexes(lines);
  const subjects = attestIndexes.flatMap((index) => extractSubjectPaths(lines, index));
  if (subjects.length === 0) {
    errors.push(`${ATTEST_ACTION} must declare a non-empty subject-path`);
    return subjects;
  }
  for (const subject of subjects) {
    if (!/\.tgz\b/u.test(subject) && !subject.includes('*') && !isDynamicArchiveReference(subject)) {
      errors.push(`attestation subject-path is not a package archive or archive wildcard: ${subject}`);
    }
    if (archivePattern && !isDynamicArchiveReference(subject) && !patternsOverlap(subject, archivePattern)) {
      errors.push(`attestation subject-path ${subject} does not match npm pack output ${archivePattern}`);
    }
  }
  return subjects;
}

function validateArchiveCreation(text, errors) {
  const archivePattern = archivePatternFromPack(text);
  if (!archivePattern) errors.push('missing npm pack archive creation step');
  return archivePattern;
}

function validatePublicationLinkage(kind, text, archivePattern, subjects, errors) {
  if (!archivePattern) return;
  const subjectReferences = subjects.filter((subject) =>
    /\.tgz\b/u.test(subject) || subject.includes('*') || isDynamicArchiveReference(subject)
  );
  const linkedSubject = subjectReferences.some((subject) =>
    isDynamicArchiveReference(subject) || patternsOverlap(subject, archivePattern)
  );
  if (!linkedSubject) return;

  if (kind === 'npm' || kind === 'github-packages') {
    const publishCommands = normalizedLines(text)
      .map(stripYamlComment)
      .filter((line) => /\bnpm\s+publish\b/u.test(line));
    if (publishCommands.length === 0) {
      errors.push(`${kind} workflow is missing npm publish for the attested archive`);
      return;
    }
    const dynamicSubjects = subjectReferences.filter(isDynamicArchiveReference);
    const dynamicLink = dynamicSubjects.length > 0 && dynamicSubjects.some((subject) =>
      publishCommands.some((command) => command.includes(subject))
    );
    if (!dynamicLink && !publishCommands.some((command) => containsArchiveReference(command, archivePattern))) {
      errors.push(`${kind} workflow publishes a freshly packed package instead of the attested archive ${archivePattern}`);
    }
    return;
  }

  const releaseReferences = [
    ...extractActionReferences(normalizedLines(text), 'softprops/action-gh-release', ['files']),
    ...extractActionReferences(normalizedLines(text), 'actions/upload-release-asset', ['asset_path']),
    ...normalizedLines(text)
      .map(stripYamlComment)
      .filter((line) => /\bgh\s+release\s+(?:upload|create)\b/u.test(line))
      .flatMap((line) => {
        const command = line.match(/\bgh\s+release\s+(?:upload|create)\b(.*)$/u)?.[1] ?? '';
        return command.match(/(?:[A-Za-z0-9_./${}-]+\/\*|[A-Za-z0-9_./${}-]+\*?\.tgz)/gu) ?? [];
      })
  ];
  if (releaseReferences.length === 0) {
    errors.push(`release workflow is missing a GitHub Release upload for ${archivePattern}`);
    return;
  }
  if (!releaseReferences.some((reference) => patternsOverlap(reference, archivePattern))) {
    errors.push(`GitHub Release upload does not use the attested archive ${archivePattern}`);
  }

}

function validatePullRequestWorkflow(lines, errors) {
  const blocks = extractPermissionBlocks(lines);
  for (const block of blocks) {
    if (/^(?:write-all|read-write|\*)$/u.test(block.mode)) {
      errors.push(`pull request workflow grants unsafe permissions: ${block.mode}`);
    }
    for (const [permission, value] of block.permissions) {
      if (value === 'write' || value === '*') {
        errors.push(`pull request workflow grants ${permission}: ${value}`);
      }
    }
  }
  if (lines.some((line) => /\buses:\s*actions\/(?:attest|attest-build-provenance)@/u.test(stripYamlComment(line)))) {
    errors.push('pull request workflow must not create artifact attestations');
  }
}

export function classifyWorkflow(fileName, text) {
  const name = String(fileName).toLowerCase();
  const source = String(text);
  const withoutComments = normalizedLines(source).map(stripYamlComment).join('\n');
  if (name.includes('pr') || /\bpull_request(?:_target)?\s*:/u.test(withoutComments)) return 'pull-request';
  if (name.includes('github-packages') || /npm\.pkg\.github\.com/u.test(withoutComments)) return 'github-packages';
  if (name.includes('release') || /softprops\/action-gh-release|gh\s+release\s+(?:create|upload)|upload-release-asset/u.test(withoutComments)) return 'release';
  if (name.includes('npm-publish') || /\bnpm\s+publish\b/u.test(withoutComments)) return 'npm';
  return 'other';
}

export function validateWorkflowText(fileName, text) {
  const kind = classifyWorkflow(fileName, text);
  const lines = normalizedLines(text);
  const errors = [];
  if (kind === 'pull-request') {
    validatePullRequestWorkflow(lines, errors);
  } else if (WORKFLOW_KINDS.includes(kind)) {
    const attestationIndexes = findAttestationLineIndexes(lines);
    validatePermissions(lines, attestationIndexes, errors);
    const archivePattern = validateArchiveCreation(text, errors);
    const subjects = validateSubjects(lines, archivePattern, errors);
    validatePublicationLinkage(kind, text, archivePattern, subjects, errors);
  }
  return { fileName, kind, errors, ok: errors.length === 0 };
}

export function validateWorkflows(workflowsDirectory, options = {}) {
  const directory = resolve(workflowsDirectory);
  const requiredKinds = options.requireKinds ?? WORKFLOW_KINDS;
  const files = existsSync(directory)
    ? readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.ya?ml$/iu.test(entry.name))
      .map((entry) => entry.name)
    : [];
  const workflows = files.map((fileName) => {
    const text = readFileSync(join(directory, fileName), 'utf8');
    return validateWorkflowText(fileName, text);
  });
  const errors = workflows.flatMap((workflow) => workflow.errors.map((error) => `${workflow.fileName}: ${error}`));
  for (const kind of requiredKinds) {
    if (!workflows.some((workflow) => workflow.kind === kind)) {
      errors.push(`missing required ${kind} workflow`);
    }
  }
  return { directory, files, workflows, errors, ok: errors.length === 0 };
}

function runCli() {
  const defaultDirectory = resolve(fileURLToPath(new URL('../workflows', import.meta.url)));
  const directory = process.argv[2] ? resolve(process.argv[2]) : defaultDirectory;
  const result = validateWorkflows(directory);
  if (!result.ok) {
    for (const error of result.errors) console.error(`Attestation workflow validation failed: ${error}`);
    process.exitCode = 1;
    return;
  }
  const checked = result.workflows.filter((workflow) => workflow.kind !== 'other').length;
  console.log(`Artifact attestation workflow validation passed: ${checked} classified workflows checked.`);
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) runCli();
