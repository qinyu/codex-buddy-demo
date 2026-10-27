import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { suiteTestFiles } from './suite-test-files.mjs';

export function suiteCommands(root, { coverage = false, execPath = process.execPath, files = suiteTestFiles(root) } = {}) {
  const scriptDir = path.join(root, 'scripts');
  // Tests spawn subprocesses and copy dependencies; bound concurrent file workers.
  const testArgs = [execPath, '--test', '--test-reporter=spec', '--test-concurrency=2', ...files];
  // c8 defaults temp to <reports-dir>/tmp and rm -rf it on start. Nested runs share the outer cwd's coverage/tmp unless both dirs are private.
  const node = coverage
    ? [execPath, path.join(root, 'node_modules/c8/bin/c8.js'), '--check-coverage', '--lines', '80',
        '--reports-dir', path.join(root, 'coverage'), '--temp-directory', path.join(root, 'coverage', 'tmp'),
        '--include', 'product-*/scripts/**.mjs', '--include', 'scripts/**.mjs', '--exclude', '**/assets/**',
        ...testArgs]
    : testArgs;
  return {
    ignore: [execPath, path.join(scriptDir, 'tracked-ignore-check.mjs')],
    node,
    python: ['python3', 'tests/test_jacoco2cobertura.py'],
  };
}

export function runSuite(root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..'), argv = process.argv.slice(2)) {
  const commands = suiteCommands(root, { coverage: argv.includes('--coverage') });
  const childEnv = { ...process.env, NODE_TEST_CONTEXT: undefined };
  delete childEnv.NODE_V8_COVERAGE;
  for (const [name, command] of [['ignore', commands.ignore], ['node', commands.node], ['python', commands.python]]) {
    const ran = spawnSync(command[0], command.slice(1), {
      cwd: root,
      stdio: 'inherit',
      shell: false,
      env: childEnv,
    });
    if (ran.status !== 0) {
      if (ran.status === null) process.stderr.write(`${ran.error?.message || ran.signal || name + ' 未退出'}\n`);
      return ran.status === null ? 1 : ran.status;
    }
  }
  return 0;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) process.exit(runSuite());
