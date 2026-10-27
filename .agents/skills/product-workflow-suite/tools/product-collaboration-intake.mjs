import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const intakeLedgerPath = 'tests/fixtures/product-collaboration-intake/intake-ledger.json';
const baselineManifestPath = 'tests/fixtures/product-collaboration-intake/baseline-manifest.json';
const sourceProvenancePath = 'tests/fixtures/product-collaboration-intake/source-provenance.json';
const sourcePrefix = 'skills/product-workflow-suite/';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function issue(code, detail) {
  return { code, detail };
}

function sourceCaseKey(item) {
  return `${item.sourceSkill}\t${item.sourceId}\t${item.sourceEvalName ?? item.evalName}`;
}

function semanticCase(item) {
  return JSON.stringify({
    prompt: item.prompt,
    expected_output: item.expected_output,
    assertions: item.assertions,
  });
}

function canonicalSupplement(item) {
  const canonical = {
    id: item.id,
    eval_name: item.eval_name,
    prompt: item.prompt,
    expected_output: item.expected_output,
    assertions: item.assertions,
  };
  if (Object.hasOwn(item, 'files')) canonical.files = item.files;
  return canonical;
}

function replaceMappedCommand(value, sourceCommand, targetCommand) {
  if (!sourceCommand || !targetCommand || typeof value !== 'string') return value;
  return value.split(sourceCommand).join(targetCommand);
}

function mappedSemantic(item, source) {
  const sourceCommand = source.sourceSkill === source.targetSkill ? null : `$product:${source.sourceSkill.replace(/^product-/, '')}`;
  const targetCommand = source.targetCommand;
  return JSON.stringify({
    prompt: replaceMappedCommand(item.prompt, sourceCommand, targetCommand),
    expected_output: replaceMappedCommand(item.expected_output, sourceCommand, targetCommand),
    assertions: (item.assertions || []).map((assertion) => replaceMappedCommand(assertion, sourceCommand, targetCommand)),
  });
}

export function checkProductCollaborationIntake({
  root,
  ledgerPath = path.join(root, intakeLedgerPath),
  sourceRoot,
  localSupplementMode = 'current',
} = {}) {
  const issues = [];
  const ledger = readJson(ledgerPath);
  const resolvedSourceRoot = sourceRoot || path.join(root, ledger.source.exportDir, 'received');
  const historical = checkHistorical(root, ledger, issues);
  const source = checkSource(root, resolvedSourceRoot, ledger, issues);
  checkRegistration(root, ledger, source.cases, issues);
  const upstream = localSupplementMode === 'historical'
    ? { count: 0, identities: new Set() }
    : checkUpstream(root, issues);
  const localSupplements = checkLocalSupplements(root, ledger, issues, localSupplementMode, upstream.identities);
  return {
    ok: issues.length === 0,
    issues,
    historical,
    localSupplements,
    upstream: { count: upstream.count },
    inventory: {
      historical: ledger.baseline.objectCount,
      source: ledger.source.caseCount,
      localSupplements: localSupplements.count,
      plannedTotal: ledger.baseline.objectCount + ledger.source.caseCount + localSupplements.count,
      upstream: upstream.count,
      currentTotal: ledger.baseline.objectCount + ledger.source.caseCount + localSupplements.count + upstream.count,
    },
    source: {
      caseCount: source.cases.length,
      appendedCount: appendedCount(ledger),
      patchId: ledger.source.productPatchId,
      commitsEqual: ledger.source.commitsMatch,
    },
  };
}

function checkBaselineManifest(root, ledger, issues) {
  const file = path.join(root, baselineManifestPath);
  if (!fs.existsSync(file)) {
    issues.push(issue('historical-baseline-drift', baselineManifestPath));
    return;
  }
  const manifest = readJson(file);
  const same = manifest.baselineCommit === ledger.baselineCommit
    && manifest.objectCount === ledger.baseline.objectCount
    && JSON.stringify(manifest.skills) === JSON.stringify(ledger.baseline.skills);
  if (!same) issues.push(issue('historical-baseline-drift', baselineManifestPath));
}

function checkHistorical(root, ledger, issues) {
  checkBaselineManifest(root, ledger, issues);
  const skills = [];
  for (const expected of ledger.baseline.skills) {
    const rel = `product-workflow-suite/${expected.skill}/evals/evals.json`;
    const file = path.join(root, rel);
    if (!fs.existsSync(file)) {
      issues.push(issue('historical-file-missing', rel));
      continue;
    }
    const bytes = fs.readFileSync(file);
    const digest = sha256(bytes);
    let data;
    try {
      data = JSON.parse(bytes.toString('utf8'));
    } catch (error) {
      issues.push(issue('historical-file-unreadable', `${rel} ${error.message}`));
      continue;
    }
    const actual = Array.isArray(data.evals) ? data.evals : [];
    if (actual.length < expected.objects.length) {
      issues.push(issue('historical-count-changed', `${expected.skill} ${actual.length}`));
    }
    expected.objects.forEach((item, index) => {
      const found = actual[index];
      if (!found || found.id !== item.id) {
        issues.push(issue('historical-case-missing', `${expected.skill}#${item.id}`));
        return;
      }
      const name = Object.hasOwn(found, 'eval_name') ? found.eval_name : null;
      if (name !== item.eval_name || sha256(JSON.stringify(found)) !== item.sha256) {
        issues.push(issue('historical-case-changed', `${expected.skill}#${item.id}`));
      }
    });
    skills.push({
      skill: expected.skill,
      count: expected.objects.length,
      sha256: digest,
      baselineSha256: expected.sha256,
      objects: expected.objects.map((item, index) => ({
        id: actual[index]?.id,
        sha256: actual[index] ? sha256(JSON.stringify(actual[index])) : null,
      })),
    });
  }
  const preservedCount = ledger.baseline.skills.reduce((sum, skill) => sum + skill.objects.length, 0);
  const objectCount = preservedCount;
  if (preservedCount !== ledger.baseline.objectCount) {
    issues.push(issue('historical-baseline-invalid', String(preservedCount)));
  }
  if (objectCount < ledger.baseline.objectCount) {
    issues.push(issue('historical-total-changed', String(objectCount)));
  }
  return { objectCount, skills };
}

function appendedCount(ledger) {
  return ledger.registration.filter((item) => item.disposition === 'accepted' || item.disposition === 'adjusted').length;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

const localSupplementPins = {
  'product-clarify\t14': {
    eval_name: 'analysis_does_not_recommend_lite',
    sha256: '6046562b8b828837299f7d34f4b3e4c9d7f7e6b6b46fa81c03427a72e89e2a43',
  },
  'product-workflow\t38': {
    eval_name: 'missing_explicit_approval_blocks_repair',
    sha256: '8624596d0e23b2ff99f9c9843bf5868b6f86614e47af180333aebfe0ff7da12c',
  },
  'product-workflow\t39': {
    eval_name: 'authorized_lookup_and_repair',
    sha256: '3e2d237335cda6988f4bc5838360bbf70d345bddac1d79689207376f469609d2',
  },
};

// Frozen main snapshot: adding upstream cases must not weaken the historical/source pins.
function checkUpstream(root, issues) {
  const rel = 'tests/fixtures/product-collaboration-intake/upstream-evals.json';
  const identities = new Set();
  const file = path.join(root, rel);
  if (!fs.existsSync(file) || sha256(fs.readFileSync(file)) !== '80448a65943eb0734e135b53e7a8fd10d9bdf9464e78d6796a82d56e1bb8ff15') {
    issues.push(issue('upstream-snapshot-drift', rel));
    return { count: 0, identities };
  }
  const snapshot = readJson(file);
  for (const row of snapshot.cases) {
    const skill = row.file.split('/')[0];
    identities.add(`${skill}\t${row.targetId}`);
    const target = path.join(root, 'product-workflow-suite', row.file);
    const matches = fs.existsSync(target)
      ? (readJson(target).evals || []).filter(item => item.id === row.targetId) : [];
    if (matches.length !== 1 || JSON.stringify(matches[0]) !== JSON.stringify({ ...row.object, id: row.targetId })) {
      issues.push(issue('upstream-case-drift', `${skill}#${row.targetId}`));
    }
  }
  return { count: snapshot.cases.length, identities };
}

function checkLocalSupplements(root, ledger, issues, localSupplementMode = 'current', upstream = new Set()) {
  const historicalContract = localSupplementMode === 'historical';
  if (!historicalContract && localSupplementMode !== 'current') {
    issues.push(issue('local-supplement-mode', String(localSupplementMode)));
  }
  const listed = Array.isArray(ledger.localSupplements) ? ledger.localSupplements : [];
  const knownSkills = new Set(ledger.baseline.skills.map((skill) => skill.skill));
  const seen = new Set();
  const bySkill = new Map();
  for (const item of listed) {
    if (!knownSkills.has(item.skill)) {
      issues.push(issue('local-supplement-unknown-skill', String(item.skill)));
      continue;
    }
    if (!positiveInteger(item.id)) {
      issues.push(issue('local-supplement-invalid-id', `${item.skill}#${item.id}`));
      continue;
    }
    const identity = `${item.skill}\t${item.id}`;
    if (seen.has(identity)) {
      issues.push(issue('local-supplement-duplicate-id', identity));
      continue;
    }
    seen.add(identity);
    const pin = localSupplementPins[identity];
    if (!pin || item.eval_name !== pin.eval_name) {
      issues.push(issue('local-supplement-unpinned', identity));
      continue;
    }
    const ids = bySkill.get(item.skill) || [];
    ids.push({ id: item.id, eval_name: pin.eval_name, sha256: pin.sha256 });
    bySkill.set(item.skill, ids);
  }
  if (!historicalContract) {
    for (const identity of Object.keys(localSupplementPins)) {
      if (seen.has(identity)) continue;
      issues.push(issue('local-supplement-missing', identity));
      const [skill, id] = identity.split('\t');
      const pin = localSupplementPins[identity];
      const ids = bySkill.get(skill) || [];
      ids.push({ id: Number(id), eval_name: pin.eval_name, sha256: pin.sha256 });
      bySkill.set(skill, ids);
    }
  }
  const ids = {};
  for (const expected of ledger.baseline.skills) {
    const historical = new Set(expected.objects.map((item) => item.id));
    const registered = new Set(
      ledger.registration
        .filter((item) => item.targetSkill === expected.skill && (item.disposition === 'accepted' || item.disposition === 'adjusted'))
        .map((item) => item.targetId),
    );
    const file = path.join(root, 'product-workflow-suite', expected.skill, 'evals', 'evals.json');
    const actual = fs.existsSync(file) ? readJson(file).evals || [] : [];
    const expectedRows = bySkill.get(expected.skill) || [];
    const found = [];
    for (const item of actual) {
      if (historical.has(item.id) || registered.has(item.id) || upstream.has(`${expected.skill}\t${item.id}`)) continue;
      const pinned = expectedRows.find((row) => row.id === item.id);
      if (!pinned || item.eval_name !== pinned.eval_name || sha256(JSON.stringify(canonicalSupplement(item))) !== pinned.sha256) {
        issues.push(issue('local-supplement-content-drift', `${expected.skill}#${item.id}`));
      }
      found.push(item.id);
    }
    if (found.join(',') !== expectedRows.map((row) => row.id).join(',')) {
      issues.push(issue('local-supplement-drift', `${expected.skill} ${found.join(',')}`));
    }
    if (expectedRows.length) ids[expected.skill] = expectedRows.map((row) => row.id);
  }
  return { count: listed.length, ids };
}

function loadSourceSnapshot(root, ledger, issues) {
  const rel = ledger.source.snapshotPath;
  const file = path.join(root, rel || '');
  if (!rel || !fs.existsSync(file)) {
    issues.push(issue('source-snapshot-missing', rel || 'source.snapshotPath'));
    return [];
  }
  const bytes = fs.readFileSync(file);
  if (sha256(bytes) !== ledger.source.snapshotSha256) {
    issues.push(issue('source-snapshot-changed', `${rel} ${sha256(bytes)}`));
  }
  let snapshot;
  try {
    snapshot = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    issues.push(issue('source-snapshot-unreadable', error.message));
    return [];
  }
  if (snapshot.sourceCommit !== ledger.source.originalCommit || snapshot.cases?.length !== ledger.source.caseCount) {
    issues.push(issue('source-snapshot-identity', `${snapshot.sourceCommit} ${snapshot.cases?.length}`));
  }
  return snapshot.cases || [];
}

function sameList(left, right) {
  return Array.isArray(left) && Array.isArray(right)
    && left.length === right.length
    && left.every((item, index) => item === right[index]);
}

function metadataMatchesLedger(metadata, ledger) {
  const original = metadata?.original;
  const received = metadata?.received;
  if (!original || !received) return false;
  const listed = ledger.source.files.map((file) => `${sourcePrefix}${file.path}`);
  return original.commit === ledger.source.originalCommit
    && received.commit === ledger.source.receivedCommit
    && original.parent === ledger.source.originalParent
    && received.parent === ledger.source.receivedParent
    && original.productPatchId === ledger.source.productPatchId
    && received.productPatchId === ledger.source.receivedProductPatchId
    && original.patchSha256 === ledger.source.patchSha256
    && received.patchSha256 === ledger.source.patchSha256
    && sameList(original.changedFiles, listed)
    && sameList(received.changedFiles, listed)
    && ledger.source.files.every((file) => {
      const rel = `${sourcePrefix}${file.path}`;
      return original.sha256?.[rel] === file.originalSha256 && received.sha256?.[rel] === file.sha256;
    });
}

function readSourceMetadata(root, rel, issues) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    issues.push(issue('source-metadata-missing', rel));
    return null;
  }
  try {
    return readJson(file);
  } catch (error) {
    issues.push(issue('source-metadata-unreadable', `${rel} ${error.message}`));
    return null;
  }
}

function checkSourceMetadata(root, ledger, issues) {
  const provenance = readSourceMetadata(root, sourceProvenancePath, issues);
  if (provenance && !metadataMatchesLedger(provenance, ledger)) {
    issues.push(issue('source-metadata-drift', sourceProvenancePath));
  }
  const exportDir = ledger.source.exportDir || '';
  if (!exportDir || !fs.existsSync(path.join(root, exportDir))) return;
  const metadataRel = path.join(exportDir, 'metadata.json');
  const exported = readSourceMetadata(root, metadataRel, issues);
  if (!exported) return;
  if (!provenance || JSON.stringify(exported) !== JSON.stringify(provenance) || !metadataMatchesLedger(exported, ledger)) {
    issues.push(issue('source-metadata-drift', metadataRel));
  }
}

function checkSource(root, sourceRoot, ledger, issues) {
  checkSourceMetadata(root, ledger, issues);
  if (ledger.source.productPatchId !== ledger.source.receivedProductPatchId) {
    issues.push(issue('source-patch-diverged', ledger.source.productPatchId));
  }
  if (!ledger.source.commitsMatch) issues.push(issue('source-commits-diverged', 'content hashes differ'));
  const cases = [];
  const seen = new Set();
  const sourcePresent = fs.existsSync(sourceRoot);
  for (const file of ledger.source.files) {
    const rel = `${sourcePrefix}${file.path}`;
    const full = path.join(sourceRoot, rel);
    if (!sourcePresent) break;
    if (!fs.existsSync(full)) {
      issues.push(issue('source-file-missing', rel));
      continue;
    }
    const digest = sha256(fs.readFileSync(full));
    if (digest !== file.sha256) issues.push(issue('source-file-changed', `${rel} ${digest}`));
    if (!file.path.endsWith('/evals/evals.json')) continue;
    let data;
    try {
      data = readJson(full);
    } catch (error) {
      issues.push(issue('source-file-unreadable', `${rel} ${error.message}`));
      continue;
    }
    for (const item of data.evals || []) {
      const sourceSkill = file.path.split('/')[0];
      const identity = { sourceSkill, sourceId: item.id, sourceEvalName: item.eval_name };
      const key = sourceCaseKey(identity);
      if (seen.has(key)) issues.push(issue('source-case-duplicate', key));
      seen.add(key);
      cases.push({ ...identity, body: semanticCase(item), object: item });
    }
  }
  const catalog = new Map();
  for (const item of ledger.source.cases) {
    const key = sourceCaseKey({
      sourceSkill: item.sourceSkill,
      sourceId: item.sourceId,
      sourceEvalName: item.evalName,
    });
    if (catalog.has(key)) issues.push(issue('source-catalog-duplicate', key));
    catalog.set(key, item);
  }
  const snapshotCases = loadSourceSnapshot(root, ledger, issues);
  if (!sourcePresent) {
    for (const item of snapshotCases) {
      const identity = { sourceSkill: item.sourceSkill, sourceId: item.sourceId, sourceEvalName: item.evalName };
      const key = sourceCaseKey(identity);
      if (seen.has(key)) issues.push(issue('source-case-duplicate', key));
      seen.add(key);
      cases.push({ ...identity, body: semanticCase(item.object), object: item.object });
    }
  }
  if (cases.length !== ledger.source.caseCount) {
    issues.push(issue('source-case-count', String(cases.length)));
  }
  const snapshotByKey = new Map(snapshotCases.map((item) => [sourceCaseKey(item), item]));
  for (const item of cases) {
    const key = sourceCaseKey(item);
    if (!catalog.has(key)) issues.push(issue('source-case-unlisted', key));
    const snapshot = snapshotByKey.get(key);
    if (!snapshot || semanticCase(snapshot.object) !== item.body) {
      issues.push(issue('source-case-body-drift', key));
    }
  }
  for (const item of ledger.source.cases) {
    if (!seen.has(sourceCaseKey({ sourceSkill: item.sourceSkill, sourceId: item.sourceId, sourceEvalName: item.evalName }))) {
      issues.push(issue('source-case-missing', sourceCaseKey({
        sourceSkill: item.sourceSkill,
        sourceId: item.sourceId,
        sourceEvalName: item.evalName,
      })));
    }
  }
  return { cases };
}

function checkRegistration(root, ledger, sourceCases, issues) {
  const bySource = new Map(sourceCases.map((item) => [sourceCaseKey(item), item]));
  const seen = new Set();
  const assignedTargets = new Set();
  const appendedIds = new Map();
  for (const item of ledger.registration) {
    const key = sourceCaseKey(item);
    if (seen.has(key)) issues.push(issue('source-case-duplicate', key));
    seen.add(key);
    const source = bySource.get(key);
    if (!source) {
      issues.push(issue('source-case-missing', key));
      continue;
    }
    const catalogEntry = ledger.source.cases.find((candidate) => sourceCaseKey(candidate) === key);
    const commandMismatch = Object.hasOwn(item, 'targetCommand') && item.targetCommand !== catalogEntry?.targetCommand;
    if (!catalogEntry || catalogEntry.targetSkill !== item.targetSkill || commandMismatch) {
      issues.push(issue('registration-target-mapping', key));
    }
    if (catalogEntry && catalogEntry.disposition !== item.disposition) {
      issues.push(issue('registration-disposition-drift', key));
    }
    if (!['pending', 'accepted', 'adjusted', 'excluded'].includes(item.disposition)) {
      issues.push(issue('registration-disposition-invalid', key));
    }
    if (item.disposition === 'pending' || item.disposition === 'excluded') continue;
    const targetKey = `${item.targetSkill}\t${item.targetId}`;
    if (assignedTargets.has(targetKey)) {
      issues.push(issue('registration-target-duplicate', `${key} -> ${item.targetSkill}#${item.targetId}`));
    }
    assignedTargets.add(targetKey);
    const ids = appendedIds.get(item.targetSkill) || [];
    ids.push(item.targetId);
    appendedIds.set(item.targetSkill, ids);
    const expectedTargetFile = `${item.targetSkill}/evals/evals.json`;
    if (item.targetFile && item.targetFile !== expectedTargetFile) {
      issues.push(issue('registration-target-file', `${key} -> ${item.targetFile}`));
    }
    const targetFile = path.join(root, 'product-workflow-suite', expectedTargetFile);
    const target = fs.existsSync(targetFile) ? readJson(targetFile) : { evals: [] };
    const matches = (target.evals || []).filter((candidate) => candidate.id === item.targetId);
    if (matches.length !== 1) {
      issues.push(issue('registration-target-missing', `${key} -> ${item.targetSkill}#${item.targetId}`));
      continue;
    }
    const targetName = matches[0].eval_name;
    const listed = ledger.source.cases.find((candidate) => sourceCaseKey(candidate) === key);
    const mappedSource = mappedSemantic(source.object, { ...listed, targetSkill: item.targetSkill });
    if (item.disposition === 'accepted' && (targetName !== item.sourceEvalName || mappedSource !== semanticCase(matches[0]))) {
      issues.push(issue('registration-semantic-mismatch', key));
    }
    if (item.disposition === 'adjusted' && !item.adjustment) {
      issues.push(issue('registration-adjustment-missing', key));
    }
    if (item.assertionCrossMapping) {
      const pin = item.assertionCrossMapping;
      const adaptedText = sha256(matches[0].expected_output);
      const adaptedAssertions = sha256(JSON.stringify(matches[0].assertions || []));
      const sourceText = sha256(source.object.expected_output);
      const sourceAssertions = sha256(JSON.stringify(source.object.assertions || []));
      const pinned = pin.disposition === item.disposition
        && pin.sourceTrueAdaptedDiffers === true
        && pin.sourceExpectedOutputSha256 === sourceText
        && pin.sourceAssertionsSha256 === sourceAssertions
        && pin.adaptedExpectedOutputSha256 === adaptedText
        && pin.adaptedAssertionsSha256 === adaptedAssertions
        && sourceText !== adaptedText
        && sourceAssertions !== adaptedAssertions;
      if (!pinned) issues.push(issue('adapted-assertion-drift', `${item.targetSkill}#${item.targetId}`));
    }
  }
  for (const item of ledger.registration) {
    if (item.disposition !== 'excluded' || item.exclusionReason) continue;
    issues.push(issue('registration-exclusion-missing', sourceCaseKey(item)));
  }
  for (const item of ledger.source.cases) {
    if (!seen.has(sourceCaseKey(item))) issues.push(issue('source-case-missing', sourceCaseKey(item)));
  }
  const historicalIds = new Map(ledger.baseline.skills.map((skill) => [
    skill.skill,
    new Set(skill.objects.map((item) => item.id)),
  ]));
  for (const [skill, ids] of appendedIds) {
    const historical = historicalIds.get(skill) || new Set();
    const maxHistorical = Math.max(0, ...historical);
    const expected = ids.map((_, index) => maxHistorical + index + 1);
    const unique = new Set(ids);
    if (unique.size !== ids.length || ids.some((id, index) => id !== expected[index]) || ids.some((id) => historical.has(id))) {
      issues.push(issue('registration-target-not-appended', `${skill} ${ids.join(',')}`));
    }
  }
}
