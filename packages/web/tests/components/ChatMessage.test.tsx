import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ShownMessage } from 'generative-ai-use-cases';

import ChatMessage from '../../src/components/ChatMessage';

const markdownMock = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="markdown-content">{children}</div>
));

const setTypingTextInputMock = vi.fn();

vi.mock('../../src/components/Markdown', () => ({
  default: (props: { children: React.ReactNode }) => markdownMock(props),
}));

vi.mock('../../src/components/ButtonCopy', () => ({
  default: () => <div />,
}));

vi.mock('../../src/components/ButtonFeedback', () => ({
  default: () => <div />,
}));

vi.mock('../../src/components/ButtonIcon', () => ({
  default: ({ children }: { children?: React.ReactNode }) => (
    <button type="button">{children}</button>
  ),
}));

vi.mock('../../src/components/ZoomUpImage', () => ({
  default: () => <div />,
}));

vi.mock('../../src/components/ZoomUpVideo', () => ({
  default: () => <div />,
}));

vi.mock('../../src/components/FileCard', () => ({
  default: () => <div />,
}));

vi.mock('../../src/components/FeedbackForm', () => ({
  default: () => <div />,
}));

vi.mock('../../src/components/Textarea', () => ({
  default: () => <textarea />,
}));

vi.mock('../../src/assets/bedrock.svg?react', () => ({
  default: () => <div data-testid="bedrock-icon" />,
}));

vi.mock('../../src/hooks/useChat', () => ({
  default: () => ({
    sendFeedback: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useTyping', () => ({
  default: () => ({
    setTypingTextInput: setTypingTextInputMock,
    typingTextOutput: '```chart\n{"type":"bar"}\n```',
  }),
}));

vi.mock('../../src/hooks/useFiles', () => ({
  default: () => ({
    getFileDownloadSignedUrl: vi.fn(),
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/chat' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function buildAssistantMessage(content: string): ShownMessage {
  return {
    role: 'assistant',
    content,
  };
}

describe('ChatMessage', () => {
  beforeEach(() => {
    markdownMock.mockClear();
    setTypingTextInputMock.mockClear();
  });

  it('keeps the streaming cursor outside markdown for assistant messages', () => {
    render(
      <ChatMessage
        chatContent={buildAssistantMessage('partial chart')}
        loading
      />
    );

    expect(screen.getByTestId('markdown-content').textContent).toBe(
      '```chart\n{"type":"bar"}\n```'
    );
    expect(screen.getByTestId('assistant-stream-cursor').textContent).toBe('▍');
    expect(screen.getByTestId('markdown-content').textContent).not.toContain(
      '▍'
    );
  });

  it('shows only the standalone loading cursor when assistant content is empty', () => {
    render(<ChatMessage chatContent={buildAssistantMessage('')} loading />);

    expect(screen.queryByTestId('assistant-stream-cursor')).toBeNull();
    expect(screen.getByText('▍')).toBeTruthy();
  });
});
