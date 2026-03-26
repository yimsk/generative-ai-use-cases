# Realtime Translation Monitor Display Enhancement

## TL;DR

> **Quick Summary**: Add a new projection-friendly monitor page for realtime translation with dark theme, topic summary tracking, and pre-recording structured context input.
>
> **Deliverables**:
>
> - New `/realtime-translation/monitor` route with projection display
> - Differential topic summary ("現在のトピック") with user-selectable model
> - Pre-recording structured context form (会議名、参加者、背景)
> - English mode toggle for topic + translation display
> - Optional collapsible context menu during recording
> - Tests for new components and hooks
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Task 1 → Task 3 → Task 5 → Task 7 → F1-F4

---

## Context

### Original Request

User wants to enhance the realtime translation feature with:

1. A monitor/projection-style display (based on a reference screenshot showing dark background, two-column layout, topic bar)
2. Topic summary functionality ("今なにを話してるか" — what are we talking about now)
3. Pre-recording context input (currently only available during recording)

### Interview Summary

**Key Discussions**:

- Monitor display: dark bg, left=narrow transcript sidebar, right=large white Japanese text, topic bar above translation, English mode toggle
- Topic summary: differential update — pass current topic + new segment to light model, ask "topic changed?". Prevents flickering.
- Summary model: user-selectable (same selector as translation model, likely light/fast model)
- Summary language: follows translation target language
- Context input: structured form (会議名、参加者、背景) BEFORE recording. Optional collapsible menu during recording.
- Route: new separate route (keep existing `/realtime-translation`)
- English mode: toggles topic bar + right panel display language
- Each transcript segment should hold both `ja` and `en` display text so English mode can switch instantly without retranslation
- Tests: after implementation, following existing patterns

**Research Findings**:

- Context input currently only during recording (`packages/web/src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation.tsx`)
- Settings panel hidden during recording (`if (isRecording) return null`)
- Summary prompt style exists (`claude.ts:225-232`) for manual generation — reusable pattern
- `useTranslationCore` passes context via `<consider>` tag
- `useMeetingMinutes` hook available for generation logic
- Monitor page IS the recording interface (no cross-page state sync needed)

### Metis Review

**Identified Gaps** (addressed):

- Topic trigger mechanism → User specified: per-translation with differential update (resolved)
- State sync between pages → Not needed: monitor page IS the recording page (resolved)
- Edge cases → Addressed in individual task QA scenarios
- Scope creep → Explicit exclusions listed in Must NOT Have

---

## Work Objectives

### Core Objective

Create a projection-friendly realtime translation display with live topic tracking and pre-recording context setup.

### Concrete Deliverables

- `packages/web/src/pages/RealtimeMonitorPage.tsx` — new monitor page
- `packages/web/src/components/RealtimeMonitor/` — monitor-specific components
- `packages/web/src/hooks/useTopicSummary.ts` — differential topic summary hook
- `packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx` — pre-recording form
- Route registration in `main.tsx` and `App.tsx`
- Locale entries for new UI strings
- Tests for new components and hooks

### Definition of Done

- [ ] `/realtime-translation/monitor` renders dark-themed projection display
- [ ] Pre-recording shows structured context form
- [ ] Recording shows two-column layout with topic bar
- [ ] Topic summary updates differentially without flickering
- [ ] English mode toggle switches display language
- [ ] `npm run web:test -- --run` passes
- [ ] `npm run web:lint` passes
- [ ] `npm run web:build` passes

### Must Have

- Dark background projection-friendly display
- Left panel: live transcript with timestamps
- Right panel: large white translation text on black background
- Topic bar: "現在のトピック：..." above translation
- English mode toggle (topic + translation language)
- Per-segment bilingual display state (`ja` + `en`) for instant toggle
- Pre-recording structured context form (会議名、参加者、背景)
- Optional collapsible context edit during recording
- Topic summary uses user-selectable model
- Debounced topic updates (prevent API spam)

### Must NOT Have (Guardrails)

- NO cross-page state synchronization (monitor IS the recording page)
- NO backend API changes (all client-side)
- NO topic history/timeline display
- NO context persistence (localStorage, backend)
- NO context templates/presets
- NO monitor theme customization
- NO translation quality feedback (thumbs up/down)
- NO multi-viewer collaboration features
- NO font size controls on monitor display
- NO modification to existing `/realtime-translation` route behavior
- NO new npm dependencies (use existing UI library)
- NO retranslation on English mode toggle

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision

- **Infrastructure exists**: YES (vitest + @testing-library/react)
- **Automated tests**: YES (tests after implementation)
- **Framework**: vitest (existing)
- **Test patterns**: follow existing test patterns in `packages/web/tests/`

### QA Policy

Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright (playwright skill) — Navigate, interact, assert DOM, screenshot
- **CLI/Build**: Use Bash — run build, lint, test commands, assert exit codes
- **Hooks/Utils**: Use Bash (vitest) — run unit tests, assert pass/fail

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — types, hooks, route, locale):
├── Task 1: Topic summary prompt + hook (useTopicSummary) [quick]
├── Task 2: Locale entries for all new UI strings [quick]
├── Task 3: Route registration + page skeleton [quick]
└── Task 4: Structured context form component [quick]

Wave 2 (Core components — parallel, depends on Wave 1):
├── Task 5: Monitor display layout (two-column, dark theme) [visual-engineering]
├── Task 6: Pre-recording setup screen (context form + start button) [visual-engineering]
├── Task 7: Topic bar component [quick]
└── Task 8: English mode toggle component [quick]

Wave 3 (Integration — depends on Wave 2):
├── Task 9: Wire monitor page (combine all components, recording lifecycle) [deep]
├── Task 10: Collapsible context menu during recording [quick]
└── Task 11: Build verification (lint + type check + build) [quick]

Wave 4 (Tests — depends on Wave 3):
├── Task 12: Unit tests for useTopicSummary hook [quick]
├── Task 13: Unit tests for monitor components [quick]
└── Task 14: Deploy to dev [quick]

Wave FINAL (Reviews):
├── F1: Plan compliance audit (oracle)
├── F2: Code quality review (unspecified-high)
├── F3: Real manual QA (unspecified-high + playwright)
└── F4: Scope fidelity check (deep)
-> Present verification results

Critical Path: Task 1 → Task 3 → Task 5 → Task 9 → Task 11 → Task 14 → F1-F4
Parallel Speedup: ~60% faster than sequential
Max Concurrent: 4 (Wave 1)
```

### Dependency Matrix

| Task | Depends On             | Blocks         | Wave |
| ---- | ---------------------- | -------------- | ---- |
| 1    | —                      | 5, 7, 9, 12    | 1    |
| 2    | —                      | 5, 6, 7, 8, 10 | 1    |
| 3    | —                      | 5, 6, 9        | 1    |
| 4    | —                      | 6, 9, 10       | 1    |
| 5    | 1, 2, 3                | 9              | 2    |
| 6    | 2, 3, 4                | 9              | 2    |
| 7    | 1, 2                   | 9              | 2    |
| 8    | 2                      | 9              | 2    |
| 9    | 1, 2, 3, 4, 5, 6, 7, 8 | 10, 11, 12, 13 | 3    |
| 10   | 2, 4, 9                | 11, 13         | 3    |
| 11   | 9, 10                  | 14             | 3    |
| 12   | 1, 9                   | 14             | 4    |
| 13   | 9, 10                  | 14             | 4    |
| 14   | 11, 12, 13             | F1-F4          | 4    |

### Agent Dispatch Summary

- **Wave 1**: 4 × `quick` — types/prompts, locale, route skeleton, form component
- **Wave 2**: 2 × `visual-engineering` + 2 × `quick` — layout, setup screen, topic bar, toggle
- **Wave 3**: 1 × `deep` + 2 × `quick` — full wiring, context menu, build check
- **Wave 4**: 2 × `quick` — tests, deploy
- **FINAL**: `oracle` + `unspecified-high` + `unspecified-high` + `deep`

---

## TODOs

- [x] 1. Topic summary prompt + useTopicSummary hook

  **What to do**:
  - Add `topicSummary` prompt style to `packages/web/src/prompts/claude.ts` — system prompt that takes current topic + new transcript segment, returns updated topic or "SAME" if unchanged
  - Add `topicSummaryPrompt` function to prompter interface in `packages/web/src/prompts/index.ts`
  - Create `packages/web/src/hooks/useTopicSummary.ts` hook:
    - Accepts: `currentTopic: string`, `newSegment: { text: string; language: string }`, `modelId: string`, `targetLanguage: string`
    - Returns: `topic: string`, `isUpdating: boolean`, `error: string | null`
    - Debounces API calls (10 second minimum between calls)
    - Calls predict with system prompt + user prompt containing current topic and new segment
    - Parses response: if "SAME" or similar → keep current topic; otherwise → update
    - Handles errors gracefully (keep current topic on failure)

  **Must NOT do**:
  - Do NOT modify existing translation prompts
  - Do NOT add backend endpoints
  - Do NOT store topic history

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single hook + prompt addition, well-defined scope
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: Not needed for hook/prompt logic

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 4)
  - **Blocks**: Tasks 5, 7, 9, 12
  - **Blocked By**: None

  **References**:

  **Pattern References**:

- `packages/web/src/prompts/claude.ts` — `translatePrompt()` and system context patterns for XML-tag prompts
- `packages/web/src/hooks/useTranslationCore.ts` — `translate()` call pattern with messages array
- `packages/web/src/hooks/useChatApi.ts` — `predict()` API call pattern

  **API/Type References**:

- `packages/web/src/prompts/index.ts` — prompter interface types
  - `packages/web/src/hooks/useModel.ts` — how model is resolved from modelId

  **Test References**:
  - `packages/web/tests/realtime-translation-split.test.ts` — existing test patterns for hooks

  **WHY Each Reference Matters**:

- `claude.ts`: Shows XML tag prompt pattern and system prompt key pattern — add a dedicated topic summary prompt alongside existing prompt helpers
- `useTranslationCore.ts`: Shows `predict({ model, messages, id })` structure — use same message construction pattern
- `useChatApi.ts`: Shows how `predict` is invoked from hooks — reuse the same API entrypoint

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Hook returns updated topic when topic changes
    Tool: Bash (vitest)
    Preconditions: useTopicSummary test file with mocked predict
    Steps:
      1. Call updateTopic with currentTopic="Introduction" and newSegment text about "budget planning"
      2. Mock predict to return "<output>Budget Planning Discussion</output>"
      3. Assert hook state: topic === "Budget Planning Discussion"
    Expected Result: Topic updated to new value
    Evidence: .sisyphus/evidence/task-1-topic-update.txt

  Scenario: Hook keeps current topic when "SAME" returned
    Tool: Bash (vitest)
    Preconditions: useTopicSummary test file with mocked predict
    Steps:
      1. Call updateTopic with currentTopic="Budget Planning" and newSegment text about budget details
      2. Mock predict to return "<output>SAME</output>"
      3. Assert hook state: topic === "Budget Planning" (unchanged)
    Expected Result: Topic unchanged
    Evidence: .sisyphus/evidence/task-1-topic-same.txt

  Scenario: Debounce prevents rapid API calls
    Tool: Bash (vitest)
    Preconditions: useTopicSummary test file with mocked predict
    Steps:
      1. Call updateTopic twice within 5 seconds
      2. Assert predict called only ONCE
    Expected Result: Second call debounced, only 1 API call
    Evidence: .sisyphus/evidence/task-1-debounce.txt

  Scenario: Error keeps current topic
    Tool: Bash (vitest)
    Preconditions: useTopicSummary test file with mocked predict throwing error
    Steps:
      1. Call updateTopic with currentTopic="Budget Planning"
      2. Mock predict to throw Error("API failure")
      3. Assert hook state: topic === "Budget Planning" (unchanged), error !== null
    Expected Result: Topic preserved, error surfaced
    Evidence: .sisyphus/evidence/task-1-error.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add topic summary prompt and useTopicSummary hook`
  - Files: `packages/web/src/prompts/claude.ts`, `packages/web/src/prompts/index.ts`, `packages/web/src/hooks/useTopicSummary.ts`

- [x] 2. Locale entries for monitor display

  **What to do**:
  - Add i18n keys to ALL 6 locale YAML files for the new monitor display UI:
    - `packages/web/public/locales/translation/en.yaml`
    - `packages/web/public/locales/translation/ja.yaml`
    - `packages/web/public/locales/translation/ko.yaml`
    - `packages/web/public/locales/translation/th.yaml`
    - `packages/web/public/locales/translation/vi.yaml`
    - `packages/web/public/locales/translation/zh.yaml`
  - Keys needed (under `monitor:` or `realtimeMonitor:` namespace):
    - `title` — "Real-Time Translation Monitor" / "リアルタイム翻訳モニター"
    - `currentTopic` — "Current Topic:" / "現在のトピック："
    - `noTopic` — "Waiting for topic..." / "トピックを検出中..."
    - `englishMode` — "English Mode" / "Englishモード"
    - `meetingName` — "Meeting Name" / "会議名"
    - `participants` — "Participants" / "参加者"
    - `background` — "Background" / "背景"
    - `startRecording` — "Start Recording" / "録音を開始する"
    - `contextSettings` — "Context Settings" / "コンテキスト設定"
    - `editContext` — "Edit Context" / "コンテキスト編集"
    - `topicModel` — "Topic Model" / "トピックモデル"
    - `clear` — "Clear" / "クリア" (may already exist)
  - Follow existing key structure/nesting patterns from the YAML files

  **Must NOT do**:
  - Do NOT modify existing locale keys
  - Do NOT add keys unrelated to monitor display

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding YAML key-value pairs across 6 files, mechanical task
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4)
  - **Blocks**: Tasks 5, 6, 7, 8, 10
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/web/public/locales/translation/ja.yaml` — existing Japanese locale structure, nesting patterns, key naming conventions
  - `packages/web/public/locales/translation/en.yaml` — existing English locale as reference for key names

  **WHY Each Reference Matters**:
  - `ja.yaml`: Shows nesting convention (e.g., `translate:`, `meetingMinutes:`) — follow same pattern with `monitor:` namespace
  - `en.yaml`: Shows key naming style (camelCase vs snake_case) — match existing convention

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All 6 locale files have monitor keys
    Tool: Bash (grep)
    Preconditions: Locale files updated
    Steps:
      1. grep -c "monitor:" packages/web/public/locales/translation/*.yaml
      2. Assert all 6 files return count >= 1
    Expected Result: All 6 files contain monitor namespace
    Evidence: .sisyphus/evidence/task-2-locales.txt

  Scenario: Japanese locale has correct translations
    Tool: Bash (grep)
    Preconditions: ja.yaml updated
    Steps:
      1. grep "現在のトピック" packages/web/public/locales/translation/ja.yaml
      2. Assert match found
    Expected Result: Japanese translations present
    Evidence: .sisyphus/evidence/task-2-ja-locale.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add locale entries for monitor display`
  - Files: `packages/web/public/locales/translation/*.yaml`

- [x] 3. Route registration + page skeleton

  **What to do**:
  - Add lazy-loaded route for `/realtime-translation/monitor` in `packages/web/src/main.tsx` following existing route patterns
  - Add menu entry in `packages/web/src/App.tsx` under the existing realtime translation menu item (as submenu or separate item)
  - Create `packages/web/src/pages/RealtimeMonitorPage.tsx` — minimal skeleton component that renders a placeholder div with "Monitor" text
  - Route should use `Suspense` wrapper like other lazy routes
  - Feature flag check: page should be accessible when `enabled('realtimeTranslation')` is true (reuse existing flag)

  **Must NOT do**:
  - Do NOT modify existing `/realtime-translation` route
  - Do NOT add complex logic to the skeleton
  - Do NOT change feature flag behavior

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Route + menu registration is mechanical, skeleton is placeholder
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 4)
  - **Blocks**: Tasks 5, 6, 9
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/web/src/main.tsx` — existing lazy route registration pattern (search for `lazy(` and `Route` components)
  - `packages/web/src/App.tsx` — existing menu item structure (search for `realtimeTranslation` or `realtime-translation`)
  - `packages/web/src/pages/RealtimeTranslationPage.tsx` — existing page component pattern to follow

  **WHY Each Reference Matters**:
  - `main.tsx`: Shows exact import/lazy/Suspense/Route pattern — copy this structure for the new route
  - `App.tsx`: Shows how menu items are structured and how feature flags gate visibility — follow same pattern
  - `RealtimeTranslationPage.tsx`: Shows page component export pattern — minimal skeleton follows this

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Route is registered and accessible
    Tool: Bash (grep)
    Preconditions: main.tsx updated
    Steps:
      1. grep "realtime-translation/monitor" packages/web/src/main.tsx
      2. Assert match found
    Expected Result: Route path registered
    Evidence: .sisyphus/evidence/task-3-route.txt

  Scenario: Menu entry exists
    Tool: Bash (grep)
    Preconditions: App.tsx updated
    Steps:
      1. grep -i "monitor" packages/web/src/App.tsx
      2. Assert match found in menu structure
    Expected Result: Menu item for monitor display present
    Evidence: .sisyphus/evidence/task-3-menu.txt

  Scenario: Build still passes after route addition
    Tool: Bash
    Preconditions: All Wave 1 tasks complete
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases && NODE_OPTIONS=--max-old-space-size=4096 npm run web:build
      2. Assert exit code 0
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-3-build.txt
  ```

  **Commit**: YES (groups with Task 2 if possible)
  - Message: `feat(realtime): add monitor route and page skeleton`
  - Files: `packages/web/src/main.tsx`, `packages/web/src/App.tsx`, `packages/web/src/pages/RealtimeMonitorPage.tsx`

- [x] 4. Structured context form component

  **What to do**:
  - Create `packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx`
  - 3 fields: 会議名 (text input, max 100 chars), 参加者 (textarea, max 500 chars), 背景 (textarea, max 2000 chars)
  - Component accepts: `values: { meetingName: string; participants: string; background: string }`, `onChange: (values) => void`, `disabled?: boolean`
  - Validation: show character count, warn on max approach, prevent submit at max exceeded
  - Use existing UI components (Input, Textarea, Label) from the project's component library
  - i18n: use locale keys from Task 2 (`monitor.meetingName`, `monitor.participants`, `monitor.background`)
  - Style: clean form layout, suitable for pre-recording setup

  **Must NOT do**:
  - Do NOT add new UI library dependencies
  - Do NOT implement persistence (localStorage, backend)
  - Do NOT add file upload or rich text

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Form component with 3 fields, well-defined props
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 2, 3)
  - **Blocks**: Tasks 6, 9, 10
  - **Blocked By**: None

  **References**:

  **Pattern References**:
  - `packages/web/src/components/MeetingMinutes/MeetingMinutesSettingsPanel.tsx` — existing form component with inputs, labels, and state management pattern
  - Search for `Input` and `Textarea` component imports in `packages/web/src/components/` to find the project's UI component library

  **WHY Each Reference Matters**:
  - `MeetingMinutesSettingsPanel.tsx`: Shows how forms are structured in this project — component composition, prop patterns, label placement
  - UI component imports: Shows which Input/Textarea components to use — must use same library

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Form renders 3 fields with labels
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "meetingName\|participants\|background" packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx
      2. Assert all 3 field names found
    Expected Result: All fields present in component
    Evidence: .sisyphus/evidence/task-4-form-fields.txt

  Scenario: Validation prevents exceeding max length
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "100\|500\|2000" packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx
      2. Assert max length constants found
    Expected Result: Max length validation present
    Evidence: .sisyphus/evidence/task-4-validation.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add structured context form component`
  - Files: `packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx`

- [x] 5. Monitor display layout (two-column, dark theme)

  **What to do**:
  - Create `packages/web/src/components/RealtimeMonitor/MonitorDisplay.tsx` — main projection layout:
    - Dark background (bg-gray-900 or bg-black)
    - Two-column layout: left ~30% transcript sidebar, right ~70% translation area
    - Left panel: scrollable list of timestamped transcript segments (source + one-line translation)
    - Right panel: large white text (min 2xl, ideally larger) on dark/black background
    - Paragraph separators (horizontal lines or spacing) between speaker turns
    - Topic bar slot above the right panel (filled by Task 7)
    - English mode toggle slot in bottom-right (filled by Task 8)
    - Minimal controls: small clear button in left panel
  - Create `packages/web/src/components/RealtimeMonitor/TranscriptSidebar.tsx` — left panel:
    - Scrollable container with timestamped segment cards
    - Each card: timestamp + source text + one-line translation
    - Compact design for sidebar display
  - Create `packages/web/src/components/RealtimeMonitor/TranslationPanel.tsx` — right panel:
    - Large text area with white text on dark background
    - Auto-scrolls to latest content
    - Paragraph blocks separated by `-----` or similar dividers
    - Receives bilingual paragraph data (`jaText`, `enText`) and only switches which field is rendered
    - Slots for topic bar and English mode toggle (passed as children or props)

  **Must NOT do**:
  - Do NOT add font size controls
  - Do NOT add theme customization
  - Do NOT use new CSS frameworks or dependencies
  - Do NOT add recording logic (that's Task 9)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Projection-friendly dark theme layout requiring design attention
  - **Skills**: [`/frontend-ui-ux`]
    - `/frontend-ui-ux`: Dark theme, two-column layout, projection readability

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 2, 3

  **References**:

  **Pattern References**:
  - `packages/web/src/components/MeetingMinutes/MeetingMinutesTranscriptSegment.tsx` — how transcript segments are displayed (timestamp, text, translation)

- `packages/web/src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation.tsx` — existing layout pattern with transcript + translation areas
  - `~/z.png` — reference screenshot showing exact desired layout (dark bg, left narrow sidebar, right large text area, topic bar, English mode toggle)

  **API/Type References**:
  - `packages/types/src/protocol.d.ts` — transcript segment type definitions (for props typing)
  - `packages/web/src/hooks/useRealtimeTranslation.ts` — return type of realtime translation hook (for props)

  **WHY Each Reference Matters**:
  - `MeetingMinutesTranscriptSegment.tsx`: Shows segment display pattern — adapt for compact sidebar view

- `MeetingMinutesRealtimeTranslation.tsx`: Shows current layout approach — understand what to improve upon
  - `~/z.png`: Reference screenshot — match this layout exactly
  - `protocol.d.ts`: Segment types — correct prop typing for transcript data
  - `useRealtimeTranslation.ts`: Return shape — correct prop types for translation data

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Monitor layout renders two-column dark theme
    Tool: Bash (grep + build)
    Preconditions: Component created
    Steps:
      1. grep "bg-gray-900\|bg-black\|bg-\[#000\]" packages/web/src/components/RealtimeMonitor/MonitorDisplay.tsx
      2. Assert dark background class found
      3. grep "grid-cols\|flex" packages/web/src/components/RealtimeMonitor/MonitorDisplay.tsx
      4. Assert two-column layout class found
    Expected Result: Dark theme + two-column layout present
    Evidence: .sisyphus/evidence/task-5-layout.txt

  Scenario: Translation text uses large white font
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "text-white\|text-2xl\|text-3xl\|text-4xl" packages/web/src/components/RealtimeMonitor/TranslationPanel.tsx
      2. Assert white text + large font classes found
    Expected Result: Large white text styling present
    Evidence: .sisyphus/evidence/task-5-typography.txt

  Scenario: Build passes with new components
    Tool: Bash
    Preconditions: All Wave 2 components created
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases && npx tsc --noEmit --project packages/web/tsconfig.json 2>&1 | head -20
      2. Assert no type errors in new files
    Expected Result: TypeScript compilation succeeds
    Evidence: .sisyphus/evidence/task-5-tsc.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add monitor display layout components`
  - Files: `packages/web/src/components/RealtimeMonitor/MonitorDisplay.tsx`, `TranscriptSidebar.tsx`, `TranslationPanel.tsx`

- [x] 6. Pre-recording setup screen

  **What to do**:
  - Create `packages/web/src/components/RealtimeMonitor/MonitorSetup.tsx` — pre-recording setup view:
    - Centered card/panel on dark background
    - Includes `StructuredContextForm` (Task 4) for meeting name, participants, background
    - Language pair selector (primary/secondary) — default to ja-JP / en-US
    - Translation model selector (reuse existing model selection pattern from MeetingMinutesSettingsPanel)
    - Topic summary model selector (separate from translation model, also reuse existing selector)
    - "Start Recording" button — large, prominent
    - Clean, minimal design suitable for operator setup before projection
  - Component accepts: `onStart: (config: MonitorConfig) => void`
  - `MonitorConfig` type: `{ meetingName, participants, background, primaryLanguage, secondaryLanguage, translationModel, topicModel, translationType }`

  **Must NOT do**:
  - Do NOT implement recording start logic (that's Task 9)
  - Do NOT add settings that don't affect monitor display
  - Do NOT duplicate existing model selector — import from shared location

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Setup screen UI design for dark theme operator view
  - **Skills**: [`/frontend-ui-ux`]
    - `/frontend-ui-ux`: Clean setup form on dark background

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 7, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 2, 3, 4

  **References**:

  **Pattern References**:
  - `packages/web/src/components/MeetingMinutes/MeetingMinutesSettingsPanel.tsx` — existing settings panel with language selectors, model selectors, input source selection
  - `packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx` — context form component from Task 4

  **WHY Each Reference Matters**:
  - `MeetingMinutesSettingsPanel.tsx`: Shows how model/language selectors are built — reuse same components
  - `StructuredContextForm.tsx`: The form to embed in setup screen — import and use directly

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Setup screen includes context form and selectors
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "StructuredContextForm\|primaryLanguage\|translationModel\|topicModel" packages/web/src/components/RealtimeMonitor/MonitorSetup.tsx
      2. Assert all key elements referenced
    Expected Result: All setup elements present
    Evidence: .sisyphus/evidence/task-6-setup.txt

  Scenario: Start button triggers onStart callback
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "onStart" packages/web/src/components/RealtimeMonitor/MonitorSetup.tsx
      2. Assert onStart prop used in button handler
    Expected Result: Start button wired to callback
    Evidence: .sisyphus/evidence/task-6-start.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add pre-recording setup screen`
  - Files: `packages/web/src/components/RealtimeMonitor/MonitorSetup.tsx`

- [x] 7. Topic bar component

  **What to do**:
  - Create `packages/web/src/components/RealtimeMonitor/TopicBar.tsx`:
    - Displays "現在のトピック：{topic}" in Japanese mode, "Current Topic: {topic}" in English mode
    - Shows loading indicator when topic is being updated
    - Shows "トピックを検出中..." / "Detecting topic..." when no topic yet
    - Compact, single-line display with truncation for long topics
    - Props: `topic: string`, `isUpdating: boolean`, `isEnglishMode: boolean`
    - Uses locale keys from Task 2

  **Must NOT do**:
  - Do NOT add topic history or timeline
  - Do NOT make it clickable/interactive

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple display component with few props
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 8)
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 1, 2

  **References**:

  **Pattern References**:

- `packages/web/src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation.tsx` — existing realtime translation component pattern and i18n usage

  **WHY Each Reference Matters**:
  - Shows i18n pattern for labels — use same `t()` function and locale key structure

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Topic bar renders topic text
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "topic\|currentTopic" packages/web/src/components/RealtimeMonitor/TopicBar.tsx
      2. Assert topic prop used in render
    Expected Result: Topic displayed
    Evidence: .sisyphus/evidence/task-7-topic-bar.txt

  Scenario: Topic bar shows loading state
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "isUpdating\|loading\|spinner" packages/web/src/components/RealtimeMonitor/TopicBar.tsx
      2. Assert loading state handling present
    Expected Result: Loading indicator when updating
    Evidence: .sisyphus/evidence/task-7-loading.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add topic bar component`
  - Files: `packages/web/src/components/RealtimeMonitor/TopicBar.tsx`

- [x] 8. English mode toggle component

  **What to do**:
  - Create `packages/web/src/components/RealtimeMonitor/EnglishModeToggle.tsx`:
    - Toggle switch (ON/OFF) positioned in bottom-right of monitor display
    - When toggled: switches topic bar label language AND translation display language
    - Toggle must switch between precomputed `ja` / `en` display fields only
    - Props: `isEnglishMode: boolean`, `onChange: (value: boolean) => void`
    - Label: "English Mode" / "Englishモード" (locale key from Task 2)
    - Small, unobtrusive design that doesn't distract from projection content

  **Must NOT do**:
  - Do NOT add more than 2 language modes (Japanese/English only)
  - Do NOT change translation API behavior — only changes which language's translation is displayed

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple toggle component
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 5, 6, 7)
  - **Blocks**: Task 9
  - **Blocked By**: Task 2

  **References**:

  **Pattern References**:
  - Search for existing toggle/switch components in `packages/web/src/components/` — reuse if available

  **WHY Each Reference Matters**:
  - Existing toggles show the project's toggle component pattern — must use same for consistency

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Toggle renders and fires onChange
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "onChange\|isEnglishMode" packages/web/src/components/RealtimeMonitor/EnglishModeToggle.tsx
      2. Assert props used correctly
    Expected Result: Toggle wired to callback
    Evidence: .sisyphus/evidence/task-8-toggle.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add English mode toggle`
  - Files: `packages/web/src/components/RealtimeMonitor/EnglishModeToggle.tsx`

- [x] 9. Wire monitor page (combine all components, recording lifecycle)

  **What to do**:
  - Rewrite `packages/web/src/pages/RealtimeMonitorPage.tsx` to be the full monitor page:
    - **Phase 1 (Pre-recording)**: Render `MonitorSetup` with context form, language/model selectors, start button
    - **Phase 2 (Recording)**: Render `MonitorDisplay` with `TopicBar`, `TranscriptSidebar`, `TranslationPanel`, `EnglishModeToggle`
    - **Phase 3 (Stopped)**: Show final state with option to clear or restart
  - Integrate hooks:
    - `useMicrophone` — recording lifecycle (start/stop transcription)
    - `useRealtimeTranslation` — translation pipeline
    - `useTopicSummary` (Task 1) — differential topic tracking
  - Wire data flow:
    - Structured context → combined into string → passed to `useRealtimeTranslation` via context parameter
    - For each segment, normalize into bilingual display state: if source is Japanese, `jaText=original`, `enText=translation`; if source is English, `enText=original`, `jaText=translation`
    - Transcript segments → `TranscriptSidebar` + `TranslationPanel`
    - New translations → trigger `useTopicSummary` update (debounced)
    - Topic result → `TopicBar`
    - English mode toggle → controls which already-available language field is displayed in right panel + topic bar label, with no retranslation
  - Recording lifecycle:
    - Start: user clicks Start → begin mic transcription with configured languages
    - During: display updates in real-time
    - Stop: user clicks Stop → stop transcription, show final state
  - Context menu (Task 10 slot): button/trigger in top-right corner to open collapsible context editor

  **Must NOT do**:
  - Do NOT modify existing `/realtime-translation` route or its components
  - Do NOT add backend API endpoints
  - Do NOT implement persistence
  - Do NOT add cross-page state sync (this page is self-contained)

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex integration of multiple hooks and components with state management
  - **Skills**: []
  - **Skills Evaluated but Omitted**:
    - `frontend-design`: This is integration/wiring, not visual design

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (sequential, depends on all Wave 1-2)
  - **Blocks**: Tasks 10, 11, 12, 13
  - **Blocked By**: Tasks 1, 2, 3, 4, 5, 6, 7, 8

  **References**:

  **Pattern References**:
  - `packages/web/src/pages/RealtimeTranslationPage.tsx` — current page pattern (wraps MeetingMinutesRealtimeTranslation with defaults)

- `packages/web/src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation.tsx` — full recording lifecycle pattern: state management, hook integration, context combination, recording start/stop handlers
  - `packages/web/src/hooks/useMicrophone.ts` — microphone hook API (startMicTranscription, stopMicTranscription, micRecording state)
  - `packages/web/src/hooks/useRealtimeTranslation.ts` — realtime translation hook API
  - `packages/web/src/hooks/useTranslationCore.ts:23-50` — how context is passed to translation

  **API/Type References**:
  - `packages/types/src/protocol.d.ts` — transcript segment types
  - `packages/web/src/components/RealtimeMonitor/MonitorSetup.tsx` — MonitorConfig type (from Task 6)
  - `packages/web/src/components/RealtimeMonitor/MonitorDisplay.tsx` — display component props
  - `packages/web/src/hooks/useTopicSummary.ts` — topic summary hook API (from Task 1)

  **WHY Each Reference Matters**:
  - `RealtimeTranslationPage.tsx`: Shows current page structure — this is the pattern to follow for the new page

- `MeetingMinutesRealtimeTranslation.tsx`: Shows how current realtime translation combines context and segments — adapt this pattern for structured monitor context
  - `useMicrophone.ts`: Shows recording API — must use same start/stop functions
  - `useRealtimeTranslation.ts`: Shows translation API — must use same translation pipeline
  - `useTopicSummary.ts`: Shows topic summary API — integrate debounced updates

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Pre-recording shows setup, recording shows monitor
    Tool: Bash (grep)
    Preconditions: Page fully implemented
    Steps:
      1. grep "MonitorSetup\|MonitorDisplay" packages/web/src/pages/RealtimeMonitorPage.tsx
      2. Assert both components referenced in page
      3. grep "isRecording\|micRecording" packages/web/src/pages/RealtimeMonitorPage.tsx
      4. Assert conditional rendering based on recording state
    Expected Result: Setup shown before recording, monitor during recording
    Evidence: .sisyphus/evidence/task-9-lifecycle.txt

  Scenario: Context flows to translation hook
    Tool: Bash (grep)
    Preconditions: Page fully implemented
    Steps:
      1. grep "context\|userDefinedContext\|meetingName\|participants\|background" packages/web/src/pages/RealtimeMonitorPage.tsx
      2. Assert structured context is combined and passed
    Expected Result: Context from form reaches translation pipeline
    Evidence: .sisyphus/evidence/task-9-context-flow.txt

  Scenario: Topic summary triggered on new translation
    Tool: Bash (grep)
    Preconditions: Page fully implemented
    Steps:
      1. grep "useTopicSummary\|updateTopic" packages/web/src/pages/RealtimeMonitorPage.tsx
      2. Assert topic hook integrated
    Expected Result: Topic updates on new translations
    Evidence: .sisyphus/evidence/task-9-topic-integration.txt

  Scenario: Build passes after full wiring
    Tool: Bash
    Preconditions: Page fully implemented
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases && NODE_OPTIONS=--max-old-space-size=4096 npm run web:build 2>&1 | tail -5
      2. Assert exit code 0
    Expected Result: Build succeeds
    Evidence: .sisyphus/evidence/task-9-build.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): wire monitor page with full recording lifecycle`
  - Files: `packages/web/src/pages/RealtimeMonitorPage.tsx`

- [x] 10. Collapsible context menu during recording

  **What to do**:
  - Create `packages/web/src/components/RealtimeMonitor/RecordingContextMenu.tsx`:
    - Small button/trigger in corner of monitor display (gear icon or "Edit Context" label)
    - Clicking opens a collapsible panel/dropdown with the `StructuredContextForm` (Task 4)
    - Form is pre-filled with current context values
    - Editing context during recording immediately updates the context passed to translation
    - Panel can be collapsed without stopping recording
    - Does NOT appear on the main projection area — only accessible via small trigger
  - Integrate into `RealtimeMonitorPage.tsx` (Task 9) — add trigger button and conditional panel rendering

  **Must NOT do**:
  - Do NOT make it a separate page or route
  - Do NOT add drag/resize functionality
  - Do NOT persist context changes

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Collapsible panel is a simple UI pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 9)
  - **Blocks**: Tasks 11, 13
  - **Blocked By**: Tasks 2, 4, 9

  **References**:

  **Pattern References**:
  - `packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx` — the form to embed (Task 4)
  - Search for existing collapsible/dropdown/accordion patterns in `packages/web/src/components/`

  **WHY Each Reference Matters**:
  - `StructuredContextForm.tsx`: The form component to embed — import and reuse
  - Existing collapse patterns: Shows project's preferred collapse implementation

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Context menu opens and closes without stopping recording
    Tool: Bash (grep)
    Preconditions: Component created
    Steps:
      1. grep "isOpen\|isExpanded\|collapsed" packages/web/src/components/RealtimeMonitor/RecordingContextMenu.tsx
      2. Assert toggle state management present
      3. grep "StructuredContextForm" packages/web/src/components/RealtimeMonitor/RecordingContextMenu.tsx
      4. Assert form embedded
    Expected Result: Collapsible panel with form
    Evidence: .sisyphus/evidence/task-10-context-menu.txt
  ```

  **Commit**: YES
  - Message: `feat(realtime): add collapsible context menu for recording`
  - Files: `packages/web/src/components/RealtimeMonitor/RecordingContextMenu.tsx`, `packages/web/src/pages/RealtimeMonitorPage.tsx` (integration)

- [x] 11. Build verification (lint + type check + build)

  **What to do**:
  - Run full verification suite:
    - `npm run web:lint` — no errors
    - `npx tsc --noEmit --project packages/web/tsconfig.json` — no type errors
    - `NODE_OPTIONS=--max-old-space-size=4096 npm run web:build` — build succeeds
  - Fix any issues found
  - Ensure no console.log in production code
  - Ensure no unused imports
  - Ensure no `as any` or `@ts-ignore`

  **Must NOT do**:
  - Do NOT suppress errors with `@ts-ignore`
  - Do NOT skip lint rules

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running verification commands and fixing issues
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (after Task 10)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 9, 10

  **References**: None needed — standard verification commands

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All verification commands pass
    Tool: Bash
    Preconditions: All Wave 1-3 tasks complete
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases && npm run web:lint 2>&1 | tail -5
      2. Assert exit code 0
      3. cd /home/ec2-user/work/generative-ai-use-cases && NODE_OPTIONS=--max-old-space-size=4096 npm run web:build 2>&1 | tail -5
      4. Assert exit code 0
    Expected Result: All checks pass
    Evidence: .sisyphus/evidence/task-11-verification.txt
  ```

  **Commit**: YES (if fixes needed)
  - Message: `chore(realtime): fix lint and type errors`
  - Files: varies

- [x] 12. Unit tests for useTopicSummary hook

  **What to do**:
  - Create `packages/web/tests/use-topic-summary.test.ts`
  - Test cases:
    - Returns initial empty topic
    - Updates topic when LLM returns new topic
    - Keeps current topic when LLM returns "SAME"
    - Debounces rapid calls (only 1 API call within debounce window)
    - Handles API errors gracefully (preserves current topic)
    - Respects targetLanguage for output language
  - Mock `predict` function to avoid real API calls
  - Follow existing test patterns from `packages/web/tests/realtime-translation-split.test.ts`

  **Must NOT do**:
  - Do NOT make real API calls in tests
  - Do NOT test UI rendering (that's Task 13)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Unit tests for a single hook
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 1, 9

  **References**:

  **Pattern References**:
  - `packages/web/tests/realtime-translation-split.test.ts` — existing hook test patterns (mocking, renderHook, async assertions)
  - `packages/web/vite.config.ts` — test configuration (ensure test files are discovered)

  **WHY Each Reference Matters**:
  - `realtime-translation-split.test.ts`: Shows mocking pattern for predict/useChatApi — must follow same approach
  - `vite.config.ts`: Ensures test file location is included in test discovery

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All unit tests pass
    Tool: Bash
    Preconditions: Test file created
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases && npm run web:test -- --run packages/web/tests/use-topic-summary.test.ts 2>&1 | tail -10
      2. Assert all tests pass
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-12-tests.txt
  ```

  **Commit**: YES
  - Message: `test(realtime): add useTopicSummary hook tests`
  - Files: `packages/web/tests/use-topic-summary.test.ts`

- [x] 13. Unit tests for monitor components

  **What to do**:
  - Create `packages/web/tests/realtime-monitor.test.ts`
  - Test cases:
    - `TopicBar`: renders topic text, shows loading state, shows "no topic" state, switches language with English mode
    - `EnglishModeToggle`: renders toggle, fires onChange on click
    - `StructuredContextForm`: renders 3 fields, enforces max lengths, calls onChange with values
    - `RecordingContextMenu`: renders collapsed by default, expands on click, contains form when expanded
    - `MonitorSetup`: renders form and selectors, fires onStart with config
  - Use `@testing-library/react` for component tests
  - Mock child components where appropriate (e.g., mock `StructuredContextForm` inside `MonitorSetup`)
  - Follow existing test patterns

  **Must NOT do**:
  - Do NOT test hooks (that's Task 12)
  - Do NOT test full page integration (that's QA Task F3)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Component unit tests
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 4 (with Task 12)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 9, 10

  **References**:

  **Pattern References**:
  - `packages/web/tests/realtime-translation-split.test.ts` — existing test patterns
  - `packages/web/vite.config.ts` — test configuration

  **WHY Each Reference Matters**:
  - `realtime-translation-split.test.ts`: Shows test structure, mocking, assertion patterns
  - `vite.config.ts`: Ensures test file discovery includes new test file

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: All component tests pass
    Tool: Bash
    Preconditions: Test file created
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases && npm run web:test -- --run packages/web/tests/realtime-monitor.test.ts 2>&1 | tail -10
      2. Assert all tests pass
    Expected Result: 0 failures
    Evidence: .sisyphus/evidence/task-13-tests.txt
  ```

  **Commit**: YES
  - Message: `test(realtime): add monitor component tests`
  - Files: `packages/web/tests/realtime-monitor.test.ts`

- [ ] 14. Deploy to dev

  **What to do**:
  - Run CDK deploy to dev environment:
    - `cd packages/cdk && npx cdk deploy GenerativeAiUseCasesStackdev --require-approval never`
  - Verify stack reaches `UPDATE_COMPLETE`
  - Derive the active CloudFront URL from stack outputs or current env config before route verification
  - Verify the resolved CloudFront URL serves the new monitor route:
    - `curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/realtime-translation/monitor"`

  **Must NOT do**:
  - Do NOT deploy to prod
  - Do NOT modify CDK infrastructure (no new constructs)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Running deploy command and verifying
  - **Skills**: [`/git-master`]
    - `/git-master`: Commit before deploy

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 4 (after Tasks 11, 12, 13)
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 11, 12, 13

  **References**:

  **Pattern References**:
  - `packages/cdk/cdk.json` — CDK configuration for dev environment
  - `packages/cdk/parameter.ts` — environment parameters (dev config)

  **WHY Each Reference Matters**:
  - `cdk.json`: Shows context and parameters for dev deploy command
  - `parameter.ts`: Shows dev-specific configuration values

  **Acceptance Criteria**:

  **QA Scenarios (MANDATORY):**

  ```
  Scenario: Dev deployment succeeds
    Tool: Bash
    Preconditions: All tasks complete, tests pass, build passes
    Steps:
      1. cd /home/ec2-user/work/generative-ai-use-cases/packages/cdk && npx cdk deploy GenerativeAiUseCasesStackdev --require-approval never 2>&1 | tail -10
      2. Assert "UPDATE_COMPLETE" in output
    Expected Result: Stack deployed successfully
    Evidence: .sisyphus/evidence/task-14-deploy.txt

  Scenario: Monitor route accessible via CloudFront
    Tool: Bash (curl)
    Preconditions: Deployment complete
    Steps:
      1. Resolve CloudFront URL from deploy output or stack outputs into `$CLOUDFRONT_URL`
      2. curl -s -o /dev/null -w "%{http_code}" "$CLOUDFRONT_URL/realtime-translation/monitor"
      3. Assert HTTP 200
    Expected Result: Monitor page serves successfully
    Evidence: .sisyphus/evidence/task-14-cf-url.txt
  ```

  **Commit**: YES (pre-deploy commit)
  - Message: `feat(realtime): realtime monitor display with topic summary and structured context`
  - Pre-commit: `npm run web:test -- --run && npm run web:lint`

---

## Final Verification Wave

> 4 review agents run in PARALLEL. ALL must APPROVE.

- [ ] F1. **Plan Compliance Audit** — `oracle`
      Read the plan end-to-end. For each "Must Have": verify implementation exists. For each "Must NOT Have": search codebase for forbidden patterns. Check evidence files exist in .sisyphus/evidence/. Compare deliverables against plan.
      QA Scenario: - Tool: Oracle + Bash/Read - Steps: 1. Read `.sisyphus/plans/realtime-monitor-display.md` 2. Inspect changed files and evidence files under `.sisyphus/evidence/` 3. Check every Must Have / Must NOT Have against the diff - Expected Result: Full compliance matrix with explicit approve/reject
      Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
      Run `tsc --noEmit` + linter + test suite. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop.
      QA Scenario: - Tool: Bash + Read - Steps: 1. Run `npx tsc --noEmit --project packages/web/tsconfig.json` 2. Run `npm run web:lint` 3. Run `npm run web:test -- --run` 4. Inspect changed files for banned patterns and dead code - Expected Result: Clean verification run and no banned patterns
      Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
      Start from clean state. Execute EVERY QA scenario from EVERY task. Test cross-task integration. Test edge cases: empty state, invalid input, rapid actions. Save to `.sisyphus/evidence/final-qa/`.
      QA Scenario: - Tool: Playwright + Bash - Steps: 1. Open the monitor route in browser automation 2. Exercise pre-recording setup, recording transition, English mode, context menu, and empty/error states 3. Capture screenshots and save evidence under `.sisyphus/evidence/final-qa/` - Expected Result: All high-level flows succeed with visual evidence
      Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
      For each task: read "What to do", read actual diff. Verify 1:1 — everything in spec was built, nothing beyond spec was built. Check "Must NOT do" compliance. Detect cross-task contamination.
      QA Scenario: - Tool: Deep + Read/Bash - Steps: 1. Compare each task spec block to the corresponding code diff 2. List any files or behaviors added outside task scope 3. Verify no excluded features were implemented - Expected Result: Clean scope map with compliant/non-compliant status per task
      Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **Task 1**: `feat(realtime): add topic summary prompt and useTopicSummary hook` — claude.ts, useTopicSummary.ts, prompts/index.ts
- **Task 2**: `feat(realtime): add locale entries for monitor display` — 6 × locale YAML files
- **Task 3**: `feat(realtime): add monitor route and page skeleton` — main.tsx, App.tsx, RealtimeMonitorPage.tsx
- **Task 4**: `feat(realtime): add structured context form component` — StructuredContextForm.tsx
- **Task 5**: `feat(realtime): add monitor display layout components` — RealtimeMonitor/ directory
- **Task 6**: `feat(realtime): add pre-recording setup screen` — RealtimeMonitorSetup.tsx
- **Task 7**: `feat(realtime): add topic bar component` — TopicBar.tsx
- **Task 8**: `feat(realtime): add English mode toggle` — EnglishModeToggle.tsx
- **Task 9**: `feat(realtime): wire monitor page with full recording lifecycle` — RealtimeMonitorPage.tsx
- **Task 10**: `feat(realtime): add collapsible context menu for recording` — ContextMenu.tsx
- **Task 11**: `chore(realtime): build verification and cleanup` — lint + build
- **Task 12**: `test(realtime): add useTopicSummary hook tests` — useTopicSummary.test.ts
- **Task 13**: `test(realtime): add monitor component tests` — monitor component tests
- **Task 14**: `deploy(realtime): deploy to dev environment` — CDK deploy

---

## Success Criteria

### Verification Commands

```bash
cd /home/ec2-user/work/generative-ai-use-cases
npm run web:test -- --run    # Expected: all tests pass
npm run web:lint             # Expected: no errors
NODE_OPTIONS=--max-old-space-size=4096 npm run web:build  # Expected: build succeeds
```

### Final Checklist

- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Dev deployment successful
- [ ] `/realtime-translation/monitor` accessible via CloudFront
