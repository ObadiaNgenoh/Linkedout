# `@remotejobs` bot

LinkedOut owns the `remotejobs` account in MySQL. The production API endpoint `POST /api/bots/remotejobs/run` fetches public listings from Remote OK, keeps the first 12 current listings, deduplicates by source URL, and publishes ordinary feed posts containing the job title, company, location, application link, and source logo when available. It never accepts public requests: production calls must include `x-remotejobs-secret`.

The Linode deployment runs the endpoint from a root-owned cron entry every six hours. The bot account is created lazily on the first successful crawl with the handle `@remotejobs`. Re-running the crawl is safe because the source URL is used as the duplicate key.

The app renders URLs as clickable text and branded link cards. External source images may be used as a preview URL; if a source does not provide one, the post remains text-first.

## OTA boundary

The mobile reels, autoplay-muted video player, camera capture, filters UI, link cards, inbox, settings, and OTA diagnostics are JavaScript/UI changes. They can ship via the existing Expo `preview` channel as long as the installed APK has the same `appVersion` runtime and already contains the Expo camera/video modules. A new native dependency, permission, Expo SDK, plugin, or runtime version still requires a new APK.

The Linode server does not directly install an OTA update into a phone. GitHub Actions publishes the JavaScript bundle to EAS Update; the installed APK checks that channel on load and the Settings screen can check manually. The server only provides API data and runs the remotejobs crawler.
