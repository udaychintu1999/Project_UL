/**
 * Android integration-test teardown safety.
 *
 * Flutter can resolve the base Android applicationId for cleanup even when
 * Gradle installs a suffixed test package. Disable Flutter's own uninstall
 * ONLY for P02, whose host runner owns exact-package cleanup.
 *
 * This does not suppress Flutter's potential force-stop of the base app;
 * no normal-app credentials or package files may be deleted here.
 */
export function integrationTestCleanupFlags(action) {
  return action === 'p02-1-e2e' ? ['--no-uninstall'] : [];
}
