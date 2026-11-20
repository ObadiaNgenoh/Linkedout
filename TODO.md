# LinkedOut product TODO

## Real member profiles
- [x] Allow email signups with real name, username, and email data stored in the managed database.
- [x] Add passwordless email-code signup/login with expiring, hashed verification challenges and 30-day bearer sessions.
- [x] Allow users to edit their name, username, and bio.
- [x] Allow users to choose a profile photo from their library or capture one directly with the camera, upload it through managed storage, and persist the stable photo URL.
- [x] Add a profile logout button that clears the local device session without deleting the stored account, posts, or messages.

## Existing verified exits
- [x] Remove seeded mock feed data; load posts from the managed database.
- [x] Store posts, reactions, comments, and company verification records in the managed database.
- [x] Block company-specific posting unless the member has an approved verification for that exact company.
- [x] Keep proof language explicit: proof is checked once, then deleted; production still needs secure document-review infrastructure before launch.

## LinkedOut social layer
- [ ] Let members publish text outs plus optional photo or video media with server-side type and size limits.
- [ ] Show media outs in The Wire with company context, exit tags, author identity, view counts, same-here counts, comment counts, and pass-it-on controls.
- [ ] Persist and display comments; broadcast comment events in realtime.
- [ ] Persist same-here likes/reactions with toggle behavior and realtime count updates.
- [ ] Count post views durably without double-counting the same member repeatedly.
- [ ] Let members Link/Unlink each other, show follower/following counts, and broadcast link events.
- [ ] Add durable Signals/notifications for links, same-here reactions, comments, pass-it-ons, and messages.
- [ ] Rename social copy to LinkedOut-native terms: The Wire, outs, same-here, pass-it-on, links, exit tags, exit identities, and Signals.
- [x] Keep the browser and React Native clients responsive and behaviorally aligned.
- [x] Use `noreply@linkedout.bashchat.me` for transactional email and keep `https://linkedout.us.ci/?out=<id>` as the canonical post-link base.

## Real-time communication
- [x] Persist direct messages in the managed database.
- [x] Broadcast `message:new` events through the WebSocket channel so a connected phone receives a sent message live.
- [x] Broadcast feed, reaction, comment, and presence events and refetch durable state after events.
- [x] Load messages from the database on reconnect so they remain available after a temporary disconnect.
- [x] Broadcast new social-layer events for outs, links, Signals, media, and view/reaction changes.

## Product boundaries
- [x] Keep the no-Supabase boundary.
- [x] Keep no passwords; email verification is now live, while full server-side authorization, moderation, abuse reporting, and advanced rate limiting remain launch hardening work.
- [x] Keep no job applications, recruiter marketplace, resume, or AI summaries.
- [ ] Document that public launch still needs secure auth, authorization, moderation, abuse reporting, media scanning, CDN/object storage, and notification delivery.
