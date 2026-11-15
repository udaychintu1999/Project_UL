/**
 * U_luv Flutter development helpers (no new Flutter or npm packages).
 *
 * Run from either the project root or apps/flutter_app:
 *   node apps/flutter_app/tool/flutter-workflow.mjs quick
 *   node apps/flutter_app/tool/flutter-workflow.mjs format:check
 *
 * Keep local development launch in the root npm scripts because that launcher
 * enforces loopback-only URLs and automatically configures USB adb reverse.
 */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

export const flutterAppDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Native Dart tools replace ESLint/Prettier for Dart; no duplicative dependency.
export const tasks = Object.freeze({
  analyze: [['flutter', 'analyze']],
  test: [['flutter', 'test']],
  quick: [['flutter', 'analyze'], ['flutter', 'test']],
  'format:check': [['dart', 'format', '--output=none', '--set-exit-if-changed', 'lib', 'test', 'integration_test']],
  'format:write': [['dart', 'format', 'lib', 'test', 'integration_test']],
  // Explicit opt-in until the entire older Dart source tree is normalized and
  // the project's source-contract tests accept formatter-produced whitespace.
  verify: [
    ['dart', 'format', '--output=none', '--set-exit-if-changed', 'lib', 'test', 'integration_test'],
    ['flutter', 'analyze'],
    ['flutter', 'test'],
  ],
});

export const usage = `U_luv Flutter development workflow

  quick         flutter analyze + flutter test (recommended before every commit)
  analyze       analyzer only
  test          widget tests only
  format:check  report Dart formatting differences; never rewrites files
  format:write  explicitly format Dart code (review the diff before committing)
  verify        formatting check + analyzer + widget tests (opt-in full style gate)
  help          display this help

For a real device: use root npm run dev:flutter / npm run verify:p01-3.
Do not replace the root USB reverse and local-only API safety launcher.
`;

export function runTask(name, runner = spawnSync) {
  if (name === 'help' || name === '--help' || name === '-h') {
    process.stdout.write(usage);
    return 0;
  }
  const steps = tasks[name];
  if (!steps) {
    process.stderr.write(`Unknown task: ${name}\n${usage}`);
    return 2;
  }
  for (const [command, ...args] of steps) {
    process.stdout.write(`> ${command} ${args.join(' ')}\n`);
    // Commands and arguments are fixed and explicitly allowlisted.
    const result = runner(command, args, {
      cwd: flutterAppDirectory,
      stdio: 'inherit',
      shell: process.platform === 'win32',
    });
    if (result.error) {
      process.stderr.write(`Cannot launch ${command}. Check your Flutter/Dart SDK PATH.\n`);
      return 1;
    }
    if (result.status !== 0) return result.status ?? 1;
  }
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = runTask(process.argv[2] ?? 'help');
}
