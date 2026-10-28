# LinkedOut product TODO

## Verified ex-employee identity
- [x] People have a profile-like identity with an alias, role, former company verification count, exit themes, connections, and recent activity.
- [x] Company-specific posts remain blocked until the proof gate offers offer letter, payslip, or work-email verification and shows that proof is auto-blurred, checked once, and deleted.
- [x] No Supabase authentication, database, storage, SDK, or external auth provider is used.

## LinkedIn-inspired live feed
- [x] Show a live feed of verified ex-employee activity with company context, reactions, comments, and a compose prompt.
- [x] Show live connection state and emit / receive realtime feed events through the managed WebSocket broker, with local demo fallback when the socket is unavailable.
- [x] Keep the feed text-first: no job applications, resume, video, or AI summary features.

## Network and safe-space communication
- [x] Show a Network surface with suggested quitters, shared exit themes, connection state, and active-now presence.
- [x] Show a Messages surface with safe-space conversation previews and a send action wired to realtime message events.
- [x] Preserve anonymous-by-default language while allowing richer profile context than a nameless post card.

## Company file and search
- [x] Show a company file with story count, average stay, toxic tags, leave-reason cloud, comeback split, and employer public reply.
- [x] Search by company or role, including “Safaricom Marketing”, and show matching stories.

## Delivery boundary
- [x] Deliver a portrait-friendly Expo / React Native experience with local initial data, local UI state, and an in-memory WebSocket broker for the prototype.
- [x] Keep the Paper Dossier visual system: warm paper, ink type, coral actions, yellow brand mark, editorial cards, and protective evidence language.
