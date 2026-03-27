import { describe, expect, it, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock useModel hook
vi.mock('../src/hooks/useModel', () => ({
  MODELS: {
    modelDisplayName: (modelId: string) => modelId,
  },
  textModels: [{ modelId: 'model-1' }, { modelId: 'model-2' }],
}));

import TopicBar from '../src/components/RealtimeMonitor/TopicBar';
import LanguageToggle from '../src/components/RealtimeMonitor/LanguageToggle';
import StructuredContextForm from '../src/components/RealtimeMonitor/StructuredContextForm';
import RecordingContextMenu from '../src/components/RealtimeMonitor/RecordingContextMenu';
import TranslationPanel from '../src/components/RealtimeMonitor/TranslationPanel';
import MonitorSetup, {
  type MonitorConfig,
} from '../src/components/RealtimeMonitor/MonitorSetup';
import {
  buildMonitorStaticContext,
  buildMonitorTranslationContext,
} from '../src/utils/monitorTranslationContext';

const japaneseTopic = String.fromCodePoint(
  0x4f1a,
  0x8b70,
  0x306e,
  0x8981,
  0x70b9
);
const japaneseHello = String.fromCodePoint(
  0x3053,
  0x3093,
  0x306b,
  0x3061,
  0x306f
);
const japaneseGoodbye = String.fromCodePoint(
  0x3055,
  0x3088,
  0x3046,
  0x306a,
  0x3089
);

describe('TopicBar', () => {
  it('renders topic text when provided', () => {
    render(
      React.createElement(TopicBar, {
        topic: 'Test Topic',
        isUpdating: false,
        isEnglishMode: false,
      })
    );

    expect(screen.getByText('Test Topic')).toBeInTheDocument();
    expect(screen.getByText('monitor.current_topic')).toBeInTheDocument();
  });

  it('switches displayed topic when english mode changes', () => {
    const { rerender } = render(
      React.createElement(TopicBar, {
        topicJa: japaneseTopic,
        topicEn: 'Meeting Highlights',
        isUpdating: false,
        isEnglishMode: false,
      })
    );

    expect(screen.getByText(japaneseTopic)).toBeInTheDocument();

    rerender(
      React.createElement(TopicBar, {
        topicJa: japaneseTopic,
        topicEn: 'Meeting Highlights',
        isUpdating: false,
        isEnglishMode: true,
      })
    );

    expect(screen.getByText('Meeting Highlights')).toBeInTheDocument();
  });

  it('shows detecting message when no topic', () => {
    render(
      React.createElement(TopicBar, {
        topic: '',
        isUpdating: false,
        isEnglishMode: false,
      })
    );

    expect(screen.getByText('monitor.detecting_topic')).toBeInTheDocument();
  });

  it('shows loading spinner when updating', () => {
    render(
      React.createElement(TopicBar, {
        topic: 'Test Topic',
        isUpdating: true,
        isEnglishMode: false,
      })
    );

    // The spinner is rendered as a span with animation classes
    const spinner = document.querySelector('.animate-spin');
    expect(spinner).toBeInTheDocument();
  });
});

describe('LanguageToggle', () => {
  it('renders button with label and current language', () => {
    render(
      React.createElement(LanguageToggle, {
        checked: false,
        onSwitch: () => {},
      })
    );

    expect(screen.getByText('monitor.display_language')).toBeInTheDocument();
    expect(screen.getByText('JP')).toBeInTheDocument();
  });

  it('calls onSwitch when clicked', () => {
    const onSwitch = vi.fn();
    render(
      React.createElement(LanguageToggle, {
        checked: false,
        onSwitch,
      })
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onSwitch).toHaveBeenCalledWith(true);
  });
});

describe('monitor translation context helpers', () => {
  it('builds static context from configured meeting fields', () => {
    expect(
      buildMonitorStaticContext({
        meetingName: 'Weekly Sync',
        participants: 'Alice, Bob',
        background: 'Release planning',
      })
    ).toBe(
      'Meeting name: Weekly Sync\nParticipants: Alice, Bob\nBackground: Release planning'
    );
  });

  it('combines static, generated, and recent context for translation', () => {
    expect(
      buildMonitorTranslationContext({
        staticContext: 'Meeting name: Weekly Sync',
        systemGeneratedContext: 'This is a software delivery meeting.',
        recentContext: 'We are discussing the rollout window.',
      })
    ).toBe(
      'Structured meeting context:\nMeeting name: Weekly Sync\n\nSystem-generated context:\nThis is a software delivery meeting.\n\nRecent conversation context:\nWe are discussing the rollout window.'
    );
  });
});

describe('TranslationPanel', () => {
  it('renders japanese text when english mode is off', () => {
    render(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
        ],
        isEnglishMode: false,
      })
    );

    expect(screen.getByText(japaneseHello)).toBeInTheDocument();
  });

  it('renders english text when english mode is on', () => {
    render(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
        ],
        isEnglishMode: true,
      })
    );

    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('scrolls to the latest content by default', async () => {
    const { rerender } = render(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
        ],
        isEnglishMode: false,
      })
    );

    const panel = screen.getByTestId('translation-panel') as HTMLDivElement;
    Object.defineProperty(panel, 'scrollHeight', {
      configurable: true,
      value: 480,
    });
    panel.scrollTop = 0;

    rerender(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
          {
            id: '2',
            timestamp: '00:05',
            sourceText: 'bye',
            translatedText: japaneseGoodbye,
            jaText: japaneseGoodbye,
            enText: 'bye',
          },
        ],
        isEnglishMode: false,
      })
    );

    await vi.waitFor(() => {
      expect(panel.scrollTop).toBe(480);
    });
  });

  it('stops auto-following when user scrolls up', async () => {
    render(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
        ],
        isEnglishMode: false,
      })
    );

    const panel = screen.getByTestId('translation-panel') as HTMLDivElement;
    Object.defineProperty(panel, 'scrollHeight', {
      configurable: true,
      value: 480,
    });
    Object.defineProperty(panel, 'clientHeight', {
      configurable: true,
      value: 200,
    });

    const { rerender } = render(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
          {
            id: '2',
            timestamp: '00:05',
            sourceText: 'bye',
            translatedText: japaneseGoodbye,
            jaText: japaneseGoodbye,
            enText: 'bye',
          },
        ],
        isEnglishMode: false,
      })
    );

    await vi.waitFor(() => {
      expect(panel.scrollTop).toBe(480);
    });

    fireEvent.scroll(panel, { target: { scrollTop: 0 } });

    rerender(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
          {
            id: '2',
            timestamp: '00:05',
            sourceText: 'bye',
            translatedText: japaneseGoodbye,
            jaText: japaneseGoodbye,
            enText: 'bye',
          },
          {
            id: '3',
            timestamp: '00:10',
            sourceText: 'thanks',
            translatedText: japaneseGoodbye,
            jaText: japaneseGoodbye,
            enText: 'thanks',
          },
        ],
        isEnglishMode: false,
      })
    );

    await vi.waitFor(() => {
      expect(panel.scrollTop).toBe(0);
    });
  });

  it('uses smaller body text classes than the oversized version', () => {
    render(
      React.createElement(TranslationPanel, {
        segments: [
          {
            id: '1',
            timestamp: '00:00',
            sourceText: 'hello',
            translatedText: japaneseHello,
            jaText: japaneseHello,
            enText: 'hello',
          },
        ],
        isEnglishMode: false,
      })
    );

    expect(screen.getByText(japaneseHello)).toHaveClass(
      'text-sm',
      'md:text-base'
    );
  });
});

describe('StructuredContextForm', () => {
  it('renders 3 fields with labels', () => {
    render(
      React.createElement(StructuredContextForm, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
      })
    );

    expect(screen.getByText('monitor.meeting_name')).toBeInTheDocument();
    expect(screen.getByText('monitor.participants')).toBeInTheDocument();
    expect(screen.getByText('monitor.background')).toBeInTheDocument();
  });

  it('calls onChange when input changes', () => {
    const onChange = vi.fn();
    render(
      React.createElement(StructuredContextForm, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange,
      })
    );

    const meetingNameInput = screen.getByPlaceholderText(
      'monitor.meeting_name_placeholder'
    );
    fireEvent.change(meetingNameInput, { target: { value: 'Test Meeting' } });

    expect(onChange).toHaveBeenCalledWith({
      meetingName: 'Test Meeting',
      participants: '',
      background: '',
    });
  });

  it('respects disabled prop', () => {
    render(
      React.createElement(StructuredContextForm, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
        disabled: true,
      })
    );

    const inputs = screen.getAllByRole('textbox');
    inputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
});

describe('RecordingContextMenu', () => {
  it('renders collapsed by default', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
      })
    );

    expect(screen.getByText('monitor.edit_context')).toBeInTheDocument();
    // Form should not be visible when collapsed
    expect(screen.queryByText('monitor.meeting_name')).not.toBeInTheDocument();
  });

  it('expands on button click', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
      })
    );

    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    // Form should now be visible
    expect(screen.getByText('monitor.meeting_name')).toBeInTheDocument();
    expect(screen.getByText('monitor.participants')).toBeInTheDocument();
    expect(screen.getByText('monitor.background')).toBeInTheDocument();
  });

  it('shows form when expanded', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: 'Test Meeting',
          participants: 'John, Jane',
          background: 'Test background',
        },
        onChange: () => {},
      })
    );

    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    // Check that form values are displayed
    const meetingNameInput = screen.getByDisplayValue('Test Meeting');
    expect(meetingNameInput).toBeInTheDocument();
  });

  it('calls onChange when form values change', () => {
    const onChange = vi.fn();
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange,
      })
    );

    // Expand the menu
    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    // Change a value
    const meetingNameInput = screen.getByPlaceholderText(
      'monitor.meeting_name_placeholder'
    );
    fireEvent.change(meetingNameInput, { target: { value: 'New Meeting' } });

    expect(onChange).toHaveBeenCalledWith({
      meetingName: 'New Meeting',
      participants: '',
      background: '',
    });
  });

  it('renders systemGeneratedContext textarea when prop provided', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
        systemGeneratedContext: 'test context',
      })
    );

    // Expand the menu
    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    const textarea = screen.getByLabelText('monitor.system_generated_context');
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue('test context');
  });

  it('does not render textarea when prop omitted', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
      })
    );

    // Expand the menu
    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    expect(
      screen.queryByLabelText('monitor.system_generated_context')
    ).not.toBeInTheDocument();
  });

  it('textarea has readOnly attribute', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
        systemGeneratedContext: 'some context',
      })
    );

    // Expand the menu
    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    const textarea = screen.getByLabelText('monitor.system_generated_context');
    expect(textarea).toHaveAttribute('readOnly');
  });

  it('shows placeholder when context is empty string', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
        systemGeneratedContext: '',
      })
    );

    // Expand the menu
    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    const textarea = screen.getByLabelText('monitor.system_generated_context');
    expect(textarea).toHaveAttribute(
      'placeholder',
      'monitor.system_generated_context_placeholder'
    );
  });

  it('displays provided value', () => {
    render(
      React.createElement(RecordingContextMenu, {
        values: {
          meetingName: '',
          participants: '',
          background: '',
        },
        onChange: () => {},
        systemGeneratedContext: 'AI context here',
      })
    );

    // Expand the menu
    const button = screen.getByText('monitor.edit_context');
    fireEvent.click(button);

    const textarea = screen.getByLabelText('monitor.system_generated_context');
    expect(textarea).toHaveValue('AI context here');
  });
});

describe('MonitorSetup', () => {
  it('renders setup form and selectors', () => {
    render(
      React.createElement(MonitorSetup, {
        onStart: () => {},
      })
    );

    // Check title
    expect(screen.getByText('monitor.title')).toBeInTheDocument();

    // Check that context form fields are rendered
    expect(screen.getByText('monitor.meeting_name')).toBeInTheDocument();
    expect(screen.getByText('monitor.participants')).toBeInTheDocument();
    expect(screen.getByText('monitor.background')).toBeInTheDocument();

    // Check selectors (4 comboboxes: 2 languages + 2 models)
    const selects = screen.getAllByRole('combobox');
    expect(selects).toHaveLength(4);

    // Check start button
    expect(screen.getByText('monitor.start_recording')).toBeInTheDocument();
  });

  it('calls onStart with config when button clicked', () => {
    const onStart = vi.fn();
    render(
      React.createElement(MonitorSetup, {
        onStart,
      })
    );

    // Fill in meeting name
    const meetingNameInput = screen.getByPlaceholderText(
      'monitor.meeting_name_placeholder'
    );
    fireEvent.change(meetingNameInput, { target: { value: 'Test Meeting' } });

    // Click start button
    const startButton = screen.getByText('monitor.start_recording');
    fireEvent.click(startButton);

    // onStart should be called with the config
    expect(onStart).toHaveBeenCalledWith(
      expect.objectContaining({
        meetingName: 'Test Meeting',
        participants: '',
        background: '',
        primaryLanguage: 'ja-JP',
        secondaryLanguage: 'en-US',
        translationModel: 'model-1',
        topicModel: 'model-1',
      })
    );
  });

  it('start button is disabled when languages are the same', () => {
    render(
      React.createElement(MonitorSetup, {
        onStart: () => {},
      })
    );

    // Change secondary language to match primary (second combobox)
    const secondarySelect = screen.getAllByRole('combobox')[1];
    fireEvent.change(secondarySelect, { target: { value: 'ja-JP' } });

    // Start button should be disabled
    const startButton = screen.getByText('monitor.start_recording');
    expect(startButton).toBeDisabled();
  });

  it('exports MonitorConfig type', () => {
    // Type-only test - this verifies the type is exported
    const _config: MonitorConfig = {
      meetingName: '',
      participants: '',
      background: '',
      primaryLanguage: 'ja-JP',
      secondaryLanguage: 'en-US',
      translationModel: 'model-1',
      topicModel: 'model-1',
    };
    expect(_config).toBeDefined();
  });
});
