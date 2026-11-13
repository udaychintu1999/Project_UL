/**
 * P00 LOCAL DEBUG CONNECTION SETTINGS — edit this file, not the private .env.
 * This file contains NO secrets. P00 only permits safe local HTTP endpoints.
 *
 * USB Android PHONE (recommended; works without Wi-Fi):
 *   target: 'usb'
 *   usbApiBaseUrl: 'http://127.0.0.1:3000'
 *   The npm Flutter launcher runs `adb reverse tcp:3000 tcp:3000` automatically.
 *   Keep Fastify running on PC 127.0.0.1:3000 and USB debugging authorized.
 *
 * Android Studio EMULATOR:
 *   target: 'emulator'
 *   emulatorApiBaseUrl: 'http://10.0.2.2:3000'
 *   No adb reverse is needed for the normal emulator host bridge.
 *
 * If APP_PORT changes from 3000 in apps/api/.env, update both URLs below.
 * Never put ULUV_DEV_TOKEN or a public/LAN IP address here. The debug token is
 * private and the P00 backend deliberately binds only to PC loopback.
 */
export const localFlutterConnection = Object.freeze({
  target: 'usb', // Change to 'emulator' when testing on Android Studio emulator.
  usbApiBaseUrl: 'http://127.0.0.1:3000',
  emulatorApiBaseUrl: 'http://10.0.2.2:3000',
  deviceId: '', // Optional: adb serial shown by `flutter devices`; blank = default device.
});
