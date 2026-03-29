import { render, screen, fireEvent, act } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transcript } from 'generative-ai-use-cases';
import MeetingMinutesRealtimeTranslation from '../../../src/components/MeetingMinutes/MeetingMinutesRealtimeTranslation';

type RawTranscript = {
  resultId: string;
  startTime: number;
  endTime: number;
  isPartial: boolean;
  transcripts: Transcript[];
  languageCode?: string;
};

const microphoneState = {
  rawTranscripts: [] as RawTranscript[],
  recording: false,
};

const screenAudioState = {
  rawTranscripts: [] as RawTranscript[],
  recording: false,
  error: '',
  isSupported: true,
};

const mockStartMicTranscription = vi.fn();
const mockStopMicTranscription = vi.fn();
const mockClearMicTranscripts = vi.fn();
const mockPrepareScreenCapture = vi.fn();
const mockStartScreenTranscription = vi.fn();
const mockStopScreenTranscription = vi.fn();
const mockClearScreenTranscripts = vi.fn();
const mockTranslate = vi.fn();
const mockPredict = vi.fn();

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../../src/hooks/useMicrophone', () => ({
  default: () => ({
    startTranscription: mockStartMicTranscription,
    stopTranscription: mockStopMicTranscription,
    recording: microphoneState.recording,
    clearTranscripts: mockClearMicTranscripts,
    rawTranscripts: microphoneState.rawTranscripts,
  }),
}));

vi.mock('../../../src/hooks/useScreenAudio', () => ({
  default: () => ({
    prepareScreenCapture: mockPrepareScreenCapture,
    startTranscriptionWithStream: mockStartScreenTranscription,
    stopTranscription: mockStopScreenTranscription,
    recording: screenAudioState.recording,
    clearTranscripts: mockClearScreenTranscripts,
    isSupported: screenAudioState.isSupported,
    error: screenAudioState.error,
    rawTranscripts: screenAudioState.rawTranscripts,
  }),
}));

vi.mock('../../../src/hooks/useRealtimeTranslation', () => ({
  default: () => ({
    availableModels: ['model-a'],
    translate: mockTranslate,
    translationInterval: 100,
  }),
}));

vi.mock('../../../src/hooks/useChatApi', () => ({
  default: () => ({
    predict: mockPredict,
  }),
}));

vi.mock('../../../src/hooks/useModel', () => ({
  MODELS: {
    modelIds: ['model-a'],
    modelDisplayName: (modelId: string) => modelId,
  },
  findModelByModelId: (modelId: string) => ({ modelId }),
}));

vi.mock('../../../src/components/Select', () => ({
  default: ({
    value,
    onChange,
    options,
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      data-testid={`select-${value}`}
      value={value}
      onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  ),
}));

vi.mock('../../../src/components/Textarea', () => ({
  default: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <textarea
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesSettingsPanel',
  () => ({
    default: ({
      children,
      setEnableScreenAudio,
    }: {
      children: React.ReactNode;
      setEnableScreenAudio: (enabled: boolean) => void;
    }) => (
      <div>
        <button onClick={() => setEnableScreenAudio(true)} type="button">
          enable-screen-audio
        </button>
        {children}
      </div>
    ),
  })
);

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesControlButtons',
  () => ({
    default: ({
      onStartRecording,
      onStopRecording,
      onClear,
      transcriptText,
    }: {
      onStartRecording: () => void;
      onStopRecording: () => void;
      onClear: () => void;
      transcriptText: string;
    }) => (
      <div>
        <button onClick={onStartRecording} type="button">
          start-recording
        </button>
        <button onClick={onStopRecording} type="button">
          stop-recording
        </button>
        <button onClick={onClear} type="button">
          clear-recording
        </button>
        <output data-testid="transcript-text">{transcriptText}</output>
      </div>
    ),
  })
);

vi.mock(
  '../../../src/components/MeetingMinutes/MeetingMinutesTranscriptSegment',
  () => ({
    default: (props: {
      startTime: number;
      translationTarget?: string;
      transcripts: Transcript[];
      translationSegments: Array<{ text: string; translation?: string }>;
      isPartial: boolean;
      isTranslating?: boolean;
    }) => (
      <div
        data-testid="transcript-segment"
        data-props={JSON.stringify({
          startTime: props.startTime,
          translationTarget: props.translationTarget,
          transcripts: props.transcripts.map((item) => item.transcript),
          translationSegments: props.translationSegments,
          isPartial: props.isPartial,
          isTranslating: props.isTranslating,
        })}
      />
    ),
  })
);

const transcript = (text: string, speakerLabel?: string): Transcript => ({
  transcript: text,
  speakerLabel,
});

const flushAsync = async () => {
  await act(async () => {
    await Promise.resolve();
  });
};

const readSegmentProps = () =>
  screen.getAllByTestId('transcript-segment').map((node) => {
    const raw = node.getAttribute('data-props');
    return raw ? JSON.parse(raw) : null;
  });

beforeEach(() => {
  vi.useFakeTimers();
  microphoneState.rawTranscripts = [];
  microphoneState.recording = false;
  screenAudioState.rawTranscripts = [];
  screenAudioState.recording = false;
  screenAudioState.error = '';
  screenAudioState.isSupported = true;
  mockStartMicTranscription.mockReset();
  mockStopMicTranscription.mockReset();
  mockClearMicTranscripts.mockReset();
  mockPrepareScreenCapture.mockReset();
  mockStartScreenTranscription.mockReset();
  mockStopScreenTranscription.mockReset();
  mockClearScreenTranscripts.mockReset();
  mockTranslate.mockReset();
  mockTranslate.mockResolvedValue('translated-text');
  mockPredict.mockReset();
  mockPredict.mockResolvedValue('generated context');
});

describe('MeetingMinutesRealtimeTranslation', () => {
  it('merges transcript updates by source/result id and keeps chronological order', async () => {
    const { rerender } = render(<MeetingMinutesRealtimeTranslation />);

    microphoneState.rawTranscripts = [
      {
        resultId: 'mic-2',
        startTime: 12,
        endTime: 13,
        isPartial: false,
        transcripts: [transcript('Later sentence.')],
        languageCode: 'en-US',
      },
      {
        resultId: 'mic-1',
        startTime: 4,
        endTime: 5,
        isPartial: true,
        transcripts: [transcript('Earlier draft')],
        languageCode: 'en-US',
      },
    ];

    rerender(<MeetingMinutesRealtimeTranslation />);
    await flushAsync();

    let segments = readSegmentProps();
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      startTime: 4,
      transcripts: ['Earlier draft'],
      isPartial: true,
    });
    expect(segments[1]).toMatchObject({
      startTime: 12,
      transcripts: ['Later sentence.'],
    });

    microphoneState.rawTranscripts = [
      {
        resultId: 'mic-2',
        startTime: 12,
        endTime: 13,
        isPartial: false,
        transcripts: [transcript('Later sentence.')],
        languageCode: 'en-US',
      },
      {
        resultId: 'mic-1',
        startTime: 4,
        endTime: 6,
        isPartial: false,
        transcripts: [transcript('Earlier final sentence.')],
        languageCode: 'en-US',
      },
    ];

    rerender(<MeetingMinutesRealtimeTranslation />);
    await flushAsync();

    segments = readSegmentProps();
    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({
      startTime: 4,
      transcripts: ['Earlier final sentence.'],
      isPartial: false,
    });
  });

  it('translates pending segments with the interval closure context it currently captures', async () => {
    microphoneState.recording = true;
    microphoneState.rawTranscripts = [
      {
        resultId: 'mic-1',
        startTime: 1,
        endTime: 2,
        isPartial: false,
        transcripts: [transcript('Hello everyone.')],
        languageCode: 'en-US',
      },
    ];

    render(<MeetingMinutesRealtimeTranslation />);
    await flushAsync();

    const userContext = screen.getByPlaceholderText(
      'translate.userDefinedContextPlaceholder'
    );
    const systemContext = screen.getByPlaceholderText(
      'translate.systemGeneratedContextPlaceholder'
    );

    fireEvent.change(userContext, { target: { value: 'Team sync' } });
    fireEvent.change(systemContext, { target: { value: 'Product roadmap' } });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(mockTranslate).toHaveBeenCalledWith(
      'Hello everyone.',
      'model-a',
      'Japanese',
      'Recent conversation context: Hello everyone.'
    );

    const [segment] = readSegmentProps();
    expect(segment.translationSegments[0]).toMatchObject({
      text: 'Hello everyone.',
      translation: 'translated-text',
    });
  });

  it('generates system context after 30 seconds and every minute while recording', async () => {
    microphoneState.recording = true;
    microphoneState.rawTranscripts = [
      {
        resultId: 'mic-1',
        startTime: 1,
        endTime: 2,
        isPartial: false,
        transcripts: [
          transcript(
            'This planning meeting covers migration timelines, deployment steps, and technical dependencies for the next release.'
          ),
        ],
        languageCode: 'en-US',
      },
    ];

    render(<MeetingMinutesRealtimeTranslation />);
    await flushAsync();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(mockPredict).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(60000);
    });

    expect(mockPredict).toHaveBeenCalledTimes(2);

    expect(screen.getByDisplayValue('generated context')).toBeInTheDocument();
  });
});
