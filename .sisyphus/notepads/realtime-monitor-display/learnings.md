# Learnings

## Codebase Patterns & Conventions

## StructuredContextForm Component

### Form Pattern

- Project uses native HTML inputs with Tailwind CSS (no UI library)
- Standard input styling: `className="w-full rounded border border-black/30 p-2 text-sm"`
- Label styling: `className="text-sm font-medium text-gray-700"`
- Disabled state: Add `disabled:opacity-50` to input classes + `disabled` prop

### Character Count Implementation

- Use `maxLength` attribute on inputs for enforcement
- Truncate in onChange handler: `e.target.value.slice(0, maxLength)`
- Color indicators:
  - < 75%: gray
  - 75-90%: amber
  - > 90%: red
- Character count display below each field with `text-xs` class

### i18n Keys Used

- monitor.meeting_name (max 100)
- monitor.meeting_name_placeholder
- monitor.participants (max 500)
- monitor.participants_placeholder
- monitor.background (max 2000)
- monitor.background_placeholder

### File Location

- Created: packages/web/src/components/RealtimeMonitor/StructuredContextForm.tsx
- Exports: StructuredContextValues type, default component

## Topic Summary Prompt and Hook Implementation

### Prompt Pattern (claude.ts)

- System contexts stored in `systemContexts` object keyed by pathname
- Pathnames like `/topic-summary`, `/translate`, etc.
- Prompt functions use template literals with XML tags: `<input>${params.text}</input>`
- Output extraction uses regex: `.replace(/(<output>|<\/output>|<o>|<\/o>)/g, '')`

### Prompter Interface (index.ts)

- Add type: `export type XxxParams = { ... };`
- Add method: `xxxPrompt(params: XxxParams): string;`
- Import type in claude.ts and add implementation

### Hook Pattern (useTranslationCore.ts as reference)

```typescript
// Standard imports
import { getPrompter } from '../prompts';
import { findModelByModelId } from './useModel';
import useChatApi from './useChatApi';

// Standard flow
const prompter = getPrompter(modelId);
const systemPrompt = prompter.systemContext(id);
const userPrompt = prompter.topicSummaryPrompt(params);
const model = findModelByModelId(modelId);
const messages = [
  { role: 'system' as const, content: systemPrompt },
  { role: 'user' as const, content: userPrompt },
];
const result = await predict({ model, messages, id });
```

### Debounce Implementation

- Use `useRef` for `lastCallRef` timestamp (persists across renders without triggering re-renders)
- Check `Date.now() - lastCallRef.current < debounceMs`
- If within debounce window, skip the call (don't queue - just drop)
- Update timestamp immediately before API call

### SAME Detection Pattern

- Extract content from `<output>` tags
- Case-insensitive compare: `extracted.toLowerCase() === 'same'`
- If SAME, return early without updating state
- If new topic, call `setTopic(extracted)`

### Error Handling

- On error: set error state but keep current topic unchanged
- Always set `isUpdating = false` in finally block

### Files Created/Modified

- Modified: packages/web/src/prompts/index.ts
  - Added `TopicSummaryParams` type
  - Added `topicSummaryPrompt` to `Prompter` interface
- Modified: packages/web/src/prompts/claude.ts
  - Added `/topic-summary` system context
  - Added `topicSummaryPrompt` function
- Created: packages/web/src/hooks/useTopicSummary.ts
  - Hook with debounce, error handling, SAME detection

## i18n Locale Entries for Real-Time Monitor Display

### Added monitor: namespace to all 6 locale files

- packages/web/public/locales/translation/en.yaml
- packages/web/public/locales/translation/ja.yaml
- packages/web/public/locales/translation/ko.yaml
- packages/web/public/locales/translation/th.yaml
- packages/web/public/locales/translation/vi.yaml
- packages/web/public/locales/translation/zh.yaml

### Keys added (18 total):

- title
- current_topic
- no_topic
- english_mode
- meeting_name
- participants
- background
- start_recording
- stop_recording
- context_settings
- edit_context
- topic_model
- translation_model
- clear
- restart
- primary_language
- secondary_language
- detecting_topic

### Translations provided:

- en: English (source)
- ja: Japanese
- ko: Korean
- th: Thai
- vi: Vietnamese
- zh: Chinese

### Verification:

All 6 files have 18 keys under monitor: namespace. No existing keys were modified.
- Added monitor layout components with shared `DisplaySegment` typing in `TranscriptSidebar.tsx` to keep sidebar/panel props aligned without new type files.
- Reused existing locale keys (`monitor.*`, `meetingMinutes.*`) to satisfy Shopify JSX hardcoded-content lint rules in projection UI.
- `MonitorSetup.tsx` wraps `StructuredContextForm` with parent arbitrary-variant classes to restyle its existing light inputs for the dark monitor setup without changing the shared form API.
- Exported `textModels` from `packages/web/src/hooks/useModel.ts` so monitor setup can build native selector options while still reusing `MODELS.modelDisplayName()` for labels.
- Validation stays lightweight: start is allowed only when primary/secondary languages differ and both model selectors have values; context fields remain optional.
