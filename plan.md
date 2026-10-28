# LinkedOut MVP plan

## Implementation

Build the first-run MVP as a self-contained Expo Router / React Native / TypeScript prototype using only local mocked data and local UI state. No Supabase authentication, database, storage, SDK, or external auth provider will be used. The current feed is the primary screen; the bottom bar switches between Feed, Search, Company, and You. A compose action opens a verification-first flow: the user must pass a local mocked "proof checked" gate before the story form becomes available. Search filters mocked company stories. Company view shows aggregate leave reasons, average stay, toxic tags, comeback split, and employer reply copy. The prototype is intentionally text-only and excludes DMs, jobs, resumes, video, and AI summaries.

## Project structure

- `app/(tabs)/index.tsx`: all MVP UI state, mocked stories, feed/search/company/profile views, compose and verification sheets.
- `app/(tabs)/_layout.tsx`: mobile tab shell and icon labels.
- `app.config.ts`: LinkedOut app identity and native bundle configuration.
- `assets/images/*`: square brand icon and native icon variants.
- `TODO.md`: outcome-level acceptance criteria and progress.

## Design

Three possible directions: **Paper Dossier** (0.06): editorial paper textures and redacted evidence; **Neon Exit Sign** (0.07): dark nightlife palette and glowing status colors; **Union Noticeboard** (0.05): photocopied flyers, stamps, and protest typography.

Chosen direction: **Paper Dossier**.

- **Design movement:** indie editorial zine meets workplace whistleblower bulletin.
- **Core principles:** high contrast, anonymous by default, evidence-forward, fast to scan.
- **Color philosophy:** warm paper (#F7F2E8) makes the feed feel tactile; ink (#141414) is uncompromising; coral (#F05A47) signals action and heat; yellow (#F4D35E) is the ownable LinkedOut highlight.
- **Layout paradigm:** stacked editorial cards with offset labels and a persistent bottom rail, not a conventional centered dashboard.
- **Signature elements:** oversized uppercase wordmark, small all-caps metadata labels, and coral “Same here” buttons.
- **Interaction philosophy:** every tap gives an immediate, legible state change; verification is a transparent gate rather than a hidden login wall.
- **Animation:** use native press opacity and small sheet transitions only; no distracting looping motion.
- **Typography system:** bold system sans for headlines, compact uppercase labels with letter spacing, relaxed body copy for stories.
- **Brand essence:** the anonymous exit interview for people who are done pretending; candid, sharp, protective.
- **Brand voice:** headlines like “THE TEA” and “NO CORPORATE SPIN.” Microcopy: “Say what the exit survey wouldn’t.” and “Proof first. Then spill.”
- **Wordmark & logo:** a black rounded square with a coral door/arrow cutout, paired with a condensed-looking uppercase wordmark.
- **Signature brand color:** coral #F05A47.
