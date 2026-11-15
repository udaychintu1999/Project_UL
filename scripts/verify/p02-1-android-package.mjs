/**
 * Exact-package Android cleanup for the disposable P02-1 application only.
 * `pm path` may exit nonzero when an app has not been installed yet; `pm list
 * packages` returns a successful empty list in that normal first-run case.
 * This module has no ADB side effects until the caller supplies adb().
 */
export const P02_TEST_PACKAGE = 'com.example.uluv.p02isolated';

export function isP02TestAppInstalled(output) {
  if (typeof output !== 'string') return false;
  return output.split(/\r?\n/).some((line) => line.trim() === `package:${P02_TEST_PACKAGE}`);
}

export function resetP02TestApp(deviceArgs, adb) {
  const packages = adb([...deviceArgs, 'shell', 'pm', 'list', 'packages', P02_TEST_PACKAGE]);
  if (!isP02TestAppInstalled(packages)) return false;
  const result = adb([...deviceArgs, 'uninstall', P02_TEST_PACKAGE]);
  if (!result.split(/\r?\n/).some((line) => line.trim() === 'Success')) {
    throw new Error('Dedicated P02 test package could not be uninstalled');
  }
  return true;
}
