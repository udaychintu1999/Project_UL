/**
 * Owner-operated, local-only Flutter entrypoint.
 * Node --env-file=apps/api/.env injects the private dev token at runtime.
 * Never print, persist, or send the token to a remote endpoint.
 * IMPORTANT: Flutter --dart-define embeds the dev token in a DEBUG app/test build;
 * never ship this diagnostic build to users or reuse its key for production.
 */
import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {localFlutterConnection} from '../../apps/flutter_app/dev_connection.config.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const flutterRoot = path.join(root, 'apps/flutter_app');
const flutterExe = process.platform === 'win32' ? 'flutter.bat' : 'flutter';
const [action, ...userArgs] = process.argv.slice(2);
const actions = new Set(['setup', 'run', 'test', 'e2e']);
const permittedApiHosts = new Set(['localhost', '127.0.0.1', '[::1]', '10.0.2.2']);
const usbApiHosts = new Set(['localhost', '127.0.0.1', '[::1]']);

function fail(message) {
  console.error(`U_luv Flutter: ${message}`);
  process.exit(2);
}

function parseOptions(args) {
  const options = {
    device: localFlutterConnection.deviceId,
    target: localFlutterConnection.target,
    baseUrlOverride: '',
  };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--device' || args[i] === '-d') {
      if (!args[++i]) fail('Expected a device ID after --device');
      options.device = args[i];
    } else if (args[i] === '--target') {
      if (!args[++i]) fail('Expected usb or emulator after --target');
      options.target = args[i];
    } else if (args[i] === '--api-base-url') {
      if (!args[++i]) fail('Expected an HTTP URL after --api-base-url');
      options.baseUrlOverride = args[i];
    } else {
      fail('Supported options: --target usb|emulator, --device <id>, --api-base-url <local-url>');
    }
  }
  if (!['usb', 'emulator'].includes(options.target)) fail('Target must be usb or emulator');
  if (typeof options.device !== 'string' ||
      (options.device && !/^[A-Za-z0-9._:-]+$/.test(options.device))) {
    fail('Device ID contains unsupported characters');
  }
  // Explicit CLI > optional owner-local process variable > checked-in mode config.
  const baseUrl = options.baseUrlOverride || process.env.ULUV_API_BASE_URL ||
    (options.target === 'usb' ? localFlutterConnection.usbApiBaseUrl : localFlutterConnection.emulatorApiBaseUrl);
  if (typeof baseUrl !== 'string') fail('Invalid API URL setting');
  let endpoint;
  try { endpoint = new URL(baseUrl); } catch { fail('Invalid API URL'); }
  const explicitPort = /^https?:\/\/(?:\[[^\]]+\]|[^/:?#]+):\d+(?:\/|$)/.test(baseUrl);
  if (endpoint.protocol !== 'http:' || !explicitPort || !permittedApiHosts.has(endpoint.hostname) ||
      endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
      (endpoint.pathname !== '/' && endpoint.pathname !== '')) {
    fail('P00 Flutter may send its dev token only to explicit local HTTP API hosts/ports');
  }
  return {...options, baseUrl, endpoint};
}

function prepareUsbReverse({endpoint, device}) {
  // `adb reverse` maps Android 127.0.0.1:<port> to PC 127.0.0.1:<port>.
  // This is USB-only localhost forwarding; it never exposes the debug API to Wi-Fi.
  if (!usbApiHosts.has(endpoint.hostname)) return;
  const port = endpoint.port;
  const reverseArgs = [...(device ? ['-s', device] : []), 'reverse', `tcp:${port}`, `tcp:${port}`];
  const result = spawnSync('adb', reverseArgs, {
    cwd: flutterRoot, encoding: 'utf8', stdio: 'pipe', shell: process.platform === 'win32',
  });
  if (result.error || result.status !== 0) {
    fail('ADB reverse unavailable. Check `adb devices` (authorized USB phone), Android SDK platform-tools on PATH, and select --device if multiple devices are attached. Then retry.');
  }
  console.log(`ADB reverse active: Android localhost:${port} -> PC localhost:${port}`);
}

function runFlutter(args) {
  // On Windows flutter is a batch launcher. Inputs are limited to commands,
  // validated local URLs/device IDs, and safe alphanumeric debug-only tokens.
  const child = spawnSync(flutterExe, args, {
    cwd: flutterRoot,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });
  if (child.error) fail('Flutter CLI unavailable. Install Flutter, add it to PATH, and run flutter doctor.');
  if (child.signal) fail('Flutter process terminated before completion');
  if (child.status !== 0) process.exit(child.status ?? 1);
}

if (!actions.has(action)) fail('Usage: npm run flutter:setup | dev:flutter | test:flutter | test:flutter:e2e');
if (action === 'setup') {
  if (userArgs.length) fail('Flutter setup accepts no extra arguments');
  // Generate only when absent: do not regenerate/replace existing native code.
  if (!existsSync(path.join(flutterRoot, 'android/app/src/main/AndroidManifest.xml'))) {
    runFlutter(['create', '--no-pub', '--platforms=android', '--project-name', 'uluv', '.']);
  }
  runFlutter(['pub', 'get']);
  console.log('Flutter Android project/dependencies ready; run npm run test:flutter before launch.');
} else if (action === 'test') {
  if (userArgs.length) fail('Flutter widget/static tests accept no extra arguments');
  runFlutter(['analyze']);
  runFlutter(['test']);
  console.log('Flutter analyze and widget tests PASSED; device integration is a separate gate.');
} else {
  if (process.env.APP_ENV && !['local', 'test'].includes(process.env.APP_ENV)) fail('P00 Flutter supports local/test only');
  const options = parseOptions(userArgs);
  const token = process.env.ULUV_DEV_TOKEN;
  if (!token || !/^[A-Za-z0-9_-]{24,256}$/.test(token)) {
    fail('Local token unavailable. Run npm run env:init on your PC; do not paste the token into chat.');
  }
  const define = [
    `--dart-define=ULUV_API_BASE_URL=${options.baseUrl}`,
    `--dart-define=ULUV_DEV_TOKEN=${token}`,
  ];
  // Prepare forwarding for USB localhost URLs before Flutter starts.
  // Emulator 10.0.2.2 needs no reverse.
  prepareUsbReverse(options);
  const device = options.device ? ['-d', options.device] : [];
  if (action === 'run') {
    runFlutter(['run', ...device, ...define]);
  } else {
    runFlutter(['test', 'integration_test', ...device, ...define]);
    console.log('Flutter real API/DB integration test PASSED (requires local Fastify + DynamoDB Local).');
  }
}
