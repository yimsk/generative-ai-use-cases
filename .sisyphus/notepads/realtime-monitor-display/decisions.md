# Decisions
- Kept `MonitorDisplay.tsx` self-contained with inline topic-bar and English-mode placeholders so Task 9 can swap them without extra dependencies.
- Used a slate/cyan dark palette with responsive single-column fallback below `lg` to stay projection-friendly while still loading cleanly on mobile.
- Built `MonitorSetup.tsx` with native `<select>` controls instead of shared `Select` to match the task requirement and keep the setup flow simpler on the dark operator screen.
- Defaulted monitor setup languages to `ja-JP` -> `en-US` and both model selectors to the first available text model so Task 9 can start recording with a complete config immediately.
