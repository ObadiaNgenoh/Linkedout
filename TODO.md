# LinkedOut product TODO

## Real member profiles
- [x] Allow email signups with real name, username, and email data stored in the managed database.
- [x] Do not add email verification, passwords, or user authentication yet; clearly label this as an early-access limitation.
- [x] Allow users to edit their name, username, and bio.
- [x] Allow users to choose a profile photo from their library or capture one directly with the camera, upload it through managed storage, and persist the stable photo URL.

## Real feed and verification
- [x] Remove seeded mock feed data; load posts from the managed database.
- [x] Store posts, reactions, comments, and company verification records in the managed database.
- [x] Block company-specific posting unless the member has an approved verification for that exact company.
- [x] Keep proof language explicit: proof is checked once, then deleted; production still needs secure document-review infrastructure before launch.

## Real-time communication
- [x] Persist direct messages in the managed database.
- [x] Broadcast `message:new` events through the WebSocket channel so a connected phone receives a sent message live.
- [x] Broadcast feed, reaction, comment, and presence events and refetch durable state after events.
- [x] Load messages from the database on reconnect so they remain available after a temporary disconnect.

## Product surfaces
- [x] Keep LinkedIn-inspired Feed, Network, Messages, editable You profile, company file, and search surfaces.
- [x] Keep the Paper Dossier visual system: warm paper, ink type, coral actions, yellow brand mark, editorial cards, and protective evidence language.
- [x] Keep the no-Supabase boundary.

## Explicit early-access boundary
- [x] No passwords, email verification, secure authentication, authorization boundary, moderation pipeline, or rate limiting yet.
- [x] No job applications, recruiter marketplace, resume, video, or AI summaries.
