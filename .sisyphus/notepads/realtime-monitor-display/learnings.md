## RecordingContextMenu Implementation

Created: 2026-03-26

### Component Structure
- RecordingContextMenu.tsx: Collapsible dropdown with StructuredContextForm
- Uses absolute positioning for dropdown panel
- Dark theme styling (gray-700/800) consistent with MonitorDisplay

### Integration Pattern
- Added as children of MonitorDisplay (which accepts children prop)
- Wrapped in flex container alongside EnglishModeToggle
- Local state contextValues for editable context during recording
- contextString updated to use contextValues instead of config directly

### Key Implementation Details
- Form pre-filled with current values via props
- onChange updates local state immediately
- Panel collapsible without stopping recording
- i18n key: monitor.edit_context
- Type import: StructuredContextValues from StructuredContextForm

### Lint Verification
- npm run web:lint passes
- No TypeScript errors
- No ESLint warnings
