import fs from 'node:fs';
import path from 'node:path';

const numeric = '(?:0|[1-9]\\d*)';
const identifier = `(?:${numeric}|\\d*[A-Za-z-][0-9A-Za-z-]*)`;
const semver = new RegExp(`^${numeric}\\.${numeric}\\.${numeric}(?:-${identifier}(?:\\.${identifier})*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$`);

function frontmatter(skillPath) {
  const source = fs.readFileSync(skillPath, 'utf8');
  const body = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!body) throw new Error(`缺少 frontmatter：${skillPath}`);
  return body;
}

function metadataBlock(skillPath) {
  const matches = [...frontmatter(skillPath).matchAll(/^metadata:\r?\n((?:[ \t]+[^\n]*\n?)*)/gm)];
  if (matches.length !== 1) throw new Error(`metadata 缺失或重复：${skillPath}`);
  return matches[0][1];
}

function quotedField(block, key, skillPath) {
  const lines = [...block.matchAll(new RegExp(`^( *)(${key}):(.*)$`, 'gm'))];
  if (lines.length === 0) throw new Error(`缺少 metadata.${key}：${skillPath}`);
  if (lines.length !== 1) throw new Error(`metadata.${key} 重复：${skillPath}`);
  const [, indent, , raw] = lines[0];
  const value = raw.match(/^ "([^"\r\n]+)"[ \t]*\r?$/)?.[1];
  if (indent !== '  ' || value == null) throw new Error(`metadata.${key} 不合约定：${skillPath}`);
  return value;
}

export function readSkillMetadata(skillDir) {
  const skillPath = path.join(skillDir, 'SKILL.md');
  if (!fs.existsSync(skillPath)) throw new Error(`缺少声明内容：${path.basename(skillDir)}`);
  const block = metadataBlock(skillPath);
  const version = quotedField(block, 'version', skillPath);
  if (!semver.test(version)) throw new Error(`metadata.version 非法：${version}`);
  return { version, suiteId: quotedField(block, 'suite-id', skillPath) };
}

export function suiteMetadata(source, skills, expectedSuiteId, requestedVersion) {
  const members = skills.map((name) => ({ name, ...readSkillMetadata(path.join(source, name)) }));
  for (const member of members) {
    if (member.suiteId !== expectedSuiteId) {
      throw new Error(`suite-id 与 ${expectedSuiteId} 不一致：${member.name} 为 ${member.suiteId}`);
    }
  }
  const versions = new Set(members.map((member) => member.version));
  if (versions.size !== 1) throw new Error(`同套件 metadata.version 不一致：${[...versions].join(', ')}`);
  const version = members[0].version;
  if (requestedVersion != null && requestedVersion !== version) {
    throw new Error(`请求版本 ${requestedVersion} 与 metadata.version ${version} 不一致`);
  }
  return { version, suiteId: expectedSuiteId };
}
