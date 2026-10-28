# LinkedOut product plan

## Product direction

LinkedOut is a LinkedIn-inspired professional network for people who quit or were fired. It is not a job board: the central object is a verified exit identity and the safe, useful conversation around what happened at work. People can have profiles, follow the live feed, connect with others who have shared experiences, comment, react, and message each other. Any company-specific story remains gated behind proof that the author worked there.

## Implementation

The app remains a self-contained Expo Router / React Native / TypeScript prototype with no Supabase authentication, database, storage, SDK, or external auth provider. Local mock data powers the initial experience. A small managed API WebSocket broker at `/ws` broadcasts prototype `feed:new`, `feed:reaction`, `feed:comment`, `message:new`, and `presence` events. The client shows connection state and falls back to a local demo mode if the socket is unavailable. This makes the interaction real in the preview without pretending the prototype has production identity, moderation, or durable persistence.

## Experience surfaces

- **Live Feed:** LinkedIn-like stream with verified ex-employee identity rows, reactions, comments, company context, live activity, and a compose prompt.
- **Verified profiles:** Anonymous-by-default but richer than an anonymous card: display name / alias, role, former-company verification count, exit themes, connections, and recent activity.
- **Network:** People who left similar companies or share exit themes; connect actions and a small “active now” presence signal.
- **Messages:** Direct conversations in a safe-space inbox, with a send action that emits a realtime event.
- **Company file:** Evidence-backed company view with stories and employer replies; company-specific posting stays verification-first.
- **Proof gate:** Offer letter, payslip, or work email; auto-blur, one-time review, delete-after-review copy, and Verified Ex-Employee badge.

## Design

Keep the chosen Paper Dossier direction: warm paper background, ink-black type, coral actions, yellow brand mark, editorial cards, compact metadata labels, and a protective/credible tone. Add LinkedIn-inspired density through identity rows, network stats, connection affordances, message previews, and live status—not through blue corporate branding.

## Boundaries

No Supabase. No job applications, recruiter marketplace, resumes, video, or AI summaries. The prototype's websocket broker is in-memory and not an authentication system; production would need a durable database, identity provider, moderation pipeline, rate limits, and encrypted evidence handling before launch.
