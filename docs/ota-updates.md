# LinkedOut OTA updates

LinkedOut uses Expo EAS Update for JavaScript, React Native UI, styling, and bundled asset changes. The installed APK is configured with the `preview` channel and the `appVersion` runtime policy.

## Automatic release

A push to `main` that changes `app/`, `components/`, `hooks/`, `lib/`, `global.css`, or `assets/` publishes an OTA update to the `preview` channel after TypeScript validation. The GitHub Actions workflow is `.github/workflows/publish-ota.yml`.

The existing APK workflow is manual. Start it from GitHub Actions when a change requires a new native binary.

## Manual release

Open **Actions → Publish LinkedOut OTA Update → Run workflow**, enter a release note, and run it. The workflow publishes with the existing `EXPO_TOKEN` secret.

## What still requires an APK rebuild

Create a new APK for changes to native dependencies, `app.config.ts`, permissions, app identifiers, the Expo SDK, native plugins, Android/iOS code, or anything that changes the runtime version. OTA updates cannot add native capabilities that are missing from the installed binary.

## Rollback

Use the EAS dashboard or EAS CLI to republish a previously known-good update to the `preview` channel. Keep the runtime version at `1.0.0` until a native rebuild intentionally changes it.
