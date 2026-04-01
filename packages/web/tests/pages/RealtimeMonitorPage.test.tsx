import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transcript } from 'generative-ai-use-cases';
import type { MonitorConfig } from '../../src/components/RealtimeMonitor/MonitorSetup';

const startConfig: MonitorConfig = {
  meetingName: 'Weekly Sync',
  background: 'Release planning',
  primaryLanguage: 'ja-JP',
  secondaryLanguage: 'en-US',
  translationModel: 'model-1',
  topicModel: 'topic-1',
};

type RawTranscriptSegment = {
  resultId: string;
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
  languageCode?: string;
};

type MonitorDisplayMockProps = {
  onStop?: () => void;
  onClear?: () => void;
  segments?: unknown[];
  topicJa?: string;
  topicEn?: string;
  children?: ReactNode;
};

const mockState = vi.hoisted(() => ({
  microphone: {
    startTranscription: vi.fn(),
    stopTranscription: vi.fn(),
    recording: true,
    clearTranscripts: vi.fn(),
    rawTranscripts: [] as RawTranscriptSegment[],
    error: null as Error | null,
    clientReady: false,
  },
  realtimeTranslation: {
    translate: vi.fn(),
  },
  chatApi: {
    predict: vi.fn(),
  },
  topicSummary: {
    topicJa: 'Topic JA',
    topicEn: 'Topic EN',
    isUpdating: false,
    updateTopic: vi.fn(),
  },
  meetingContext: {
    generateSystemContext: vi.fn(),
    getLanguageNameFromCode: vi.fn((languageCode: string) =>
      languageCode.startsWith('ja') ? 'Japanese' : 'English'
    ),
    getRecentSegmentsContext: vi.fn(() => 'Recent transcript context'),
    shouldGenerateContext: vi.fn(() => true),
  },
  lastDisplayProps: null as null | Record<string, unknown>,
  lastContextMenuProps: null as null | Record<string, unknown>,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../src/hooks/useMicrophone', () => ({
  default: () => mockState.microphone,
}));

vi.mock('../../src/hooks/useRealtimeTranslation', () => ({
  default: () => mockState.realtimeTranslation,
}));

vi.mock('../../src/hooks/useChatApi', () => ({
  default: () => mockState.chatApi,
}));

vi.mock('../../src/hooks/useTopicSummary', () => ({
  default: () => mockState.topicSummary,
}));

vi.mock(
  '../../src/components/MeetingMinutes/MeetingMinutesContextGenerator',
  () => ({
    generateSystemContext: mockState.meetingContext.generateSystemContext,
    getLanguageNameFromCode: mockState.meetingContext.getLanguageNameFromCode,
    getRecentSegmentsContext: mockState.meetingContext.getRecentSegmentsContext,
    shouldGenerateContext: mockState.meetingContext.shouldGenerateContext,
  })
);

vi.mock('../../src/components/RealtimeMonitor/MonitorSetup', () => ({
  default: ({ onStart }: { onStart: (config: MonitorConfig) => void }) => (
    <button type="button" onClick={() => onStart(startConfig)}>
      Start session
    </button>
  ),
}));

vi.mock('../../src/components/RealtimeMonitor/MonitorDisplay', () => ({
  default: (props: MonitorDisplayMockProps) => {
    mockState.lastDisplayProps = props;

    return (
      <div data-testid="monitor-display">
        <button type="button" onClick={() => props.onStop?.()}>
          Stop session
        </button>
        <button type="button" onClick={() => props.onClear?.()}>
          Clear session
        </button>
        <pre data-testid="segments-json">
          {JSON.stringify(props.segments ?? [])}
        </pre>
        <div data-testid="topic-ja">{String(props.topicJa ?? '')}</div>
        <div data-testid="topic-en">{String(props.topicEn ?? '')}</div>
        {props.children}
      </div>
    );
  },
}));

vi.mock('../../src/components/RealtimeMonitor/RecordingContextMenu', () => ({
  default: ({
    systemGeneratedContext,
    translationContext,
  }: {
    systemGeneratedContext?: string;
    translationContext?: string;
  }) => {
    mockState.lastContextMenuProps = {
      systemGeneratedContext,
      translationContext,
    };

    return (
      <div data-testid="recording-context-menu">
        {systemGeneratedContext ?? 'no-system-context'}
        <span data-testid="translation-context">
          {translationContext ?? ''}
        </span>
      </div>
    );
  },
}));

import RealtimeMonitorPage from '../../src/pages/RealtimeMonitorPage';

const renderPage = () => render(<RealtimeMonitorPage />);

const setRawTranscripts = (segments: RawTranscriptSegment[]) => {
  mockState.microphone.rawTranscripts = segments;
};

describe('RealtimeMonitorPage', () => {
  beforeEach(() => {
    mockState.microphone.startTranscription.mockReset();
    mockState.microphone.stopTranscription.mockReset();
    mockState.microphone.clearTranscripts.mockReset();
    mockState.microphone.recording = true;
    mockState.microphone.error = null;
    mockState.microphone.clientReady = false;
    setRawTranscripts([]);

    mockState.realtimeTranslation.translate.mockReset();
    mockState.realtimeTranslation.translate.mockResolvedValue('');

    mockState.chatApi.predict.mockReset();

    mockState.topicSummary.topicJa = 'Topic JA';
    mockState.topicSummary.topicEn = 'Topic EN';
    mockState.topicSummary.isUpdating = false;
    mockState.topicSummary.updateTopic.mockReset();

    mockState.meetingContext.generateSystemContext.mockReset();
    mockState.meetingContext.generateSystemContext.mockResolvedValue(
      'System-generated context'
    );
    mockState.meetingContext.getRecentSegmentsContext.mockClear();
    mockState.meetingContext.shouldGenerateContext.mockClear();

    mockState.lastDisplayProps = null;
    mockState.lastContextMenuProps = null;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts from setup and begins transcription when the client becomes ready', async () => {
    const view = renderPage();

    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    expect(screen.getByText('Preparing microphone...')).toBeInTheDocument();
    expect(mockState.microphone.startTranscription).not.toHaveBeenCalled();

    mockState.microphone.clientReady = true;
    view.rerender(<RealtimeMonitorPage />);

    await waitFor(() => {
      expect(mockState.microphone.clearTranscripts).toHaveBeenCalledTimes(1);
      expect(mockState.microphone.startTranscription).toHaveBeenCalledWith(
        'ja-JP'
      );
    });
  });

  it('shapes transcript segments, requests translation, and updates topic summaries', async () => {
    mockState.microphone.clientReady = true;
    mockState.realtimeTranslation.translate.mockResolvedValue(
      'こんにちは チーム'
    );

    const firstSegment: RawTranscriptSegment = {
      resultId: 'segment-1',
      startTime: 5,
      endTime: 6,
      isPartial: false,
      languageCode: 'en-US',
      transcripts: [
        {
          transcript: 'Hello team',
          speakerLabel: 'spk_0',
        } as Transcript,
      ],
    };

    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    setRawTranscripts([firstSegment]);
    view.rerender(<RealtimeMonitorPage />);

    await waitFor(() => {
      expect(mockState.realtimeTranslation.translate).toHaveBeenCalledWith(
        'Hello team',
        'model-1',
        'Japanese',
        [
          'Structured meeting context:',
          'Meeting name: Weekly Sync',
          'Background: Release planning',
          '',
          'Recent conversation context:',
          'Recent transcript context',
        ].join('\n')
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('segments-json')).toHaveTextContent(
        JSON.stringify([
          {
            id: 'segment-1',
            timestamp: '00:05',
            sourceText: 'Hello team',
            translatedText: 'こんにちは チーム',
            speaker: 'spk_0',
            jaText: 'こんにちは チーム',
            enText: 'Hello team',
          },
        ])
      );
    });

    expect(mockState.topicSummary.updateTopic).toHaveBeenCalledWith(
      'こんにちは チーム'
    );
    expect(screen.getByTestId('topic-ja')).toHaveTextContent('Topic JA');
    expect(screen.getByTestId('topic-en')).toHaveTextContent('Topic EN');
  });

  it('schedules system context generation and includes generated context in later translations', async () => {
    vi.useFakeTimers();
    mockState.microphone.clientReady = true;
    mockState.realtimeTranslation.translate
      .mockResolvedValueOnce('こんにちは チーム')
      .mockResolvedValueOnce('次の議題');

    const firstSegment: RawTranscriptSegment = {
      resultId: 'segment-1',
      startTime: 5,
      endTime: 6,
      isPartial: false,
      languageCode: 'en-US',
      transcripts: [
        {
          transcript:
            'Hello team this transcript is intentionally long enough for context generation.',
        } as Transcript,
      ],
    };

    const secondSegment: RawTranscriptSegment = {
      resultId: 'segment-2',
      startTime: 10,
      endTime: 11,
      isPartial: false,
      languageCode: 'en-US',
      transcripts: [
        {
          transcript: 'Next agenda item',
        } as Transcript,
      ],
    };

    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    setRawTranscripts([firstSegment]);
    await act(async () => {
      view.rerender(<RealtimeMonitorPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockState.realtimeTranslation.translate).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockState.meetingContext.generateSystemContext).toHaveBeenCalledWith(
      [firstSegment],
      'en-US',
      mockState.chatApi.predict
    );

    expect(screen.getByTestId('recording-context-menu')).toHaveTextContent(
      'System-generated context'
    );
    expect(mockState.lastContextMenuProps).toMatchObject({
      translationContext: [
        'Structured meeting context:',
        'Meeting name: Weekly Sync',
        'Background: Release planning',
        '',
        'System-generated context:',
        'System-generated context',
        '',
        'Recent conversation context:',
        'Recent transcript context',
      ].join('\n'),
    });

    setRawTranscripts([firstSegment, secondSegment]);
    await act(async () => {
      view.rerender(<RealtimeMonitorPage />);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockState.realtimeTranslation.translate).toHaveBeenLastCalledWith(
      'Next agenda item',
      'model-1',
      'Japanese',
      [
        'Structured meeting context:',
        'Meeting name: Weekly Sync',
        'Background: Release planning',
        '',
        'System-generated context:',
        'System-generated context',
        '',
        'Recent conversation context:',
        'Recent transcript context',
      ].join('\n')
    );
  });

  it('stops, restarts, and clears the session shell without changing routes or setup flow', async () => {
    mockState.microphone.clientReady = true;

    const view = renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Start session' }));

    await waitFor(() => {
      expect(mockState.microphone.startTranscription).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Stop session' }));

    expect(mockState.microphone.stopTranscription).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Restart' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));

    await waitFor(() => {
      expect(mockState.microphone.startTranscription).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Clear session' }));
    view.rerender(<RealtimeMonitorPage />);

    expect(
      screen.getByRole('button', { name: 'Start session' })
    ).toBeInTheDocument();
  });
});
