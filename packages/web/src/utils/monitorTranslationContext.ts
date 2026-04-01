import type { StructuredContextValues } from '../components/RealtimeMonitor/StructuredContextForm';

export const buildMonitorStaticContext = (values: StructuredContextValues) => {
  const sections = [
    values.meetingName.trim()
      ? `Meeting name: ${values.meetingName.trim()}`
      : '',
    values.background.trim() ? `Background: ${values.background.trim()}` : '',
  ].filter(Boolean);

  return sections.join('\n');
};

type BuildMonitorTranslationContextParams = {
  staticContext: string;
  systemGeneratedContext: string;
  recentContext: string;
};

export const buildMonitorTranslationContext = ({
  staticContext,
  systemGeneratedContext,
  recentContext,
}: BuildMonitorTranslationContextParams) => {
  const sections = [
    staticContext.trim()
      ? `Structured meeting context:\n${staticContext.trim()}`
      : '',
    systemGeneratedContext.trim()
      ? `System-generated context:\n${systemGeneratedContext.trim()}`
      : '',
    recentContext.trim()
      ? `Recent conversation context:\n${recentContext.trim()}`
      : '',
  ].filter(Boolean);

  if (sections.length === 0) {
    return undefined;
  }

  return sections.join('\n\n');
};
