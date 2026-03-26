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
import EnglishModeToggle from '../src/components/RealtimeMonitor/EnglishModeToggle';
import StructuredContextForm from '../src/components/RealtimeMonitor/StructuredContextForm';
import RecordingContextMenu from '../src/components/RealtimeMonitor/RecordingContextMenu';
import MonitorSetup, {
  type MonitorConfig,
} from '../src/components/RealtimeMonitor/MonitorSetup';

const japaneseTopic = String.fromCodePoint(
  0x4f1a,
  0x8b70,
  0x306e,
  0x8981,
  0x70b9
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

describe('EnglishModeToggle', () => {
  it('renders toggle with label', () => {
    render(
      React.createElement(EnglishModeToggle, {
        isEnglishMode: false,
        onChange: () => {},
      })
    );

    expect(screen.getByText('monitor.english_mode')).toBeInTheDocument();
  });

  it('calls onChange when toggled', () => {
    const onChange = vi.fn();
    render(
      React.createElement(EnglishModeToggle, {
        isEnglishMode: false,
        onChange,
      })
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    expect(onChange).toHaveBeenCalledWith(true);
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

    // Check language selectors
    expect(
      screen.getByLabelText('monitor.primary_language')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('monitor.secondary_language')
    ).toBeInTheDocument();

    // Check model selectors
    expect(
      screen.getByLabelText('monitor.translation_model')
    ).toBeInTheDocument();
    expect(screen.getByLabelText('monitor.topic_model')).toBeInTheDocument();

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

    // Change secondary language to match primary
    const secondarySelect = screen.getByLabelText('monitor.secondary_language');
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
