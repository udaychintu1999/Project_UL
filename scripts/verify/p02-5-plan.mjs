/** P02-5 is UI-only: run visual contracts then the unmodified P02-4 local gate. */
export const P02_5_STAGES = Object.freeze([
  ['P02-5 reference visual/source and safety contracts', 'test:p02-5:contracts'],
  ['Complete previously accepted P02-4 local verification, including Flutter/Android',
    'verify:p02-4'],
]);

/** Deliberately injected runner: test the fail-closed contract without Android. */
export function executeP02_5(stages, run, report = () => {}) {
  for (let index = 0; index < stages.length; index++) {
    const [description, command] = stages[index];
    report(`P02-5 GATE ${index + 1}/${stages.length}: ${description} (npm run ${command})`);
    let result;
    try { result = run(command); }
    catch { report(`P02-5 FAILED at gate ${index + 1}: ${command} (runner error)`); return false; }
    if (result?.error || result?.signal || result?.status !== 0) {
      report(`P02-5 FAILED at gate ${index + 1}: ${command}; later gates were not run.`);
      return false;
    }
    report(`P02-5 PASS gate ${index + 1}/${stages.length}: ${command}`);
  }
  return true;
}
