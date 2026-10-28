# LinkedOut product plan

## Product direction

LinkedOut is a LinkedIn-inspired professional network for people who quit or were fired. It is not a job board: the central object is a verified exit identity and the safe, useful conversation around what happened at work. People can have profiles, connect with other members, read a real-time feed, comment, react, and message each other. Any company-specific story remains gated behind proof that the author worked there.

## Current implementation

The app now uses the managed MySQL-compatible database and managed object storage directly. There is no Supabase and no seeded mock data. On first launch, a member creates a real profile with name, username, and email; the record is stored immediately. This is intentionally not authentication yet: there is no password, email verification, or secure session. The device stores its local member reference so the app can reopen the same profile.

Users can edit name, username, and bio. They can choose a profile photo from the device library or capture one with the camera. The server validates the base64 upload, sends it through the managed storage presign flow, stores the stable asset path on the user record, and returns the updated profile.

Feed posts, reactions, comments, verification records, and direct messages are persisted in MySQL. The WebSocket endpoint `/ws` broadcasts database-backed `feed:new`, `feed:reaction`, `feed:comment`, `message:new`, and `presence` events. Messages are inserted before broadcast, so a connected phone receives the message live and a reconnecting phone can load it from the database. The client refetches after realtime events to stay consistent with durable state.

## Experience surfaces

- **Live Feed:** real database posts with member identity rows, reactions, comments, company context, and live connection state.
- **Profiles:** editable name, username, bio, email display, and profile image from library or camera.
- **Network:** real member directory sourced from stored users, with direct-message actions.
- **Messages:** durable one-to-one messages sent through HTTP, broadcast over WebSocket, and reloaded from storage on reconnect.
- **Company file:** database-backed company story view and search.
- **Proof gate:** company + proof type creates a verification record; posting checks an approved verification for that exact company.

## Boundaries

No Supabase. No email verification or user authentication yet. Because there is no authentication, this release is a development/early-access build: the client-provided device/member ID is not a security boundary. Before public launch, add passwordless or password authentication, email verification, authorization checks, moderation, rate limits, encrypted proof handling, and a secure identity/session model.
