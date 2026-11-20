# LinkedOut product plan

## Product direction

LinkedOut is a professional social network for people who quit or were fired. It combines the useful profile/network context of LinkedIn with the real-time public conversation and media feed of X, while keeping its differentiator: verified exit stories and a safer, pseudonymous-by-default space for workplace truth.

The product vocabulary is LinkedOut-native: posts are **outs**, likes are **same-here** reactions, reposts are **pass-it-ons**, follows are **links**, hashtags are **exit tags**, profiles are **exit identities**, notifications are **signals**, and the home feed is **The Wire**.

## Social release architecture

The existing durable MySQL schema remains the source of truth. Posts gain long-form text, optional image/video media, media type, view counts, and visibility metadata while retaining company/role/duration and the verified-employer gate. Durable tables cover links (follows), post views, notifications, and existing comments/reactions/messages. The WebSocket broker broadcasts new outs, reactions, comments, links, signals, and message events; clients refetch durable state after events.

The API remains Express with no Supabase and no mock data. Media uploads use the existing local Linode storage adapter in production and return stable `/manus-storage/...` URLs. Upload limits are enforced server-side: images up to 8 MB, videos up to 50 MB, and supported MIME types only.

## Experience surfaces

- **The Wire:** real-time text/image/video outs with verified company context, author identity, view counts, same-here counts, comments, pass-it-on action, and live updates.
- **Exit identities:** editable name, username, bio, profile photo, follower/following counts, links, and a member’s outs.
- **Network:** discover members, follow/unfollow with the LinkedOut-native “Link” action, and message connected members.
- **Company files:** searchable verified exit stories plus aggregated counts.
- **Signals:** durable notifications for links, same-here reactions, comments, pass-it-ons, and messages.
- **Composer:** text, optional image/video, exit tags, and company verification when a post names an employer.

## Boundaries

This release intentionally keeps the early-access identity model: no password, email verification, or secure session yet. The client-provided member ID is not a security boundary. Before public launch, add secure authentication, authorization checks, moderation, rate limits, encrypted proof handling, abuse reporting, content takedown policy, media scanning/transcoding, background notifications, and proper object storage/CDN. Full LinkedIn hiring, recruiter, resume, jobs, and endorsements are out of scope.
