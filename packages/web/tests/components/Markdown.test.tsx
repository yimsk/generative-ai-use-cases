import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import Markdown from '../../src/components/Markdown';

const mockDownloadDoc = vi.fn();
const mockIsS3Url = vi.fn(() => false);
const mockGetFileDownloadSignedUrl = vi.fn();

vi.mock('../../src/hooks/useRagFile', () => ({
  default: () => ({
    downloadDoc: mockDownloadDoc,
    isS3Url: mockIsS3Url,
    downloading: false,
  }),
}));

vi.mock('../../src/hooks/useFileApi', () => ({
  default: () => ({
    getFileDownloadSignedUrl: mockGetFileDownloadSignedUrl,
  }),
}));

vi.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: '/rag' }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock('../../src/components/Mermaid/MermaidWithToggle', () => ({
  MermaidWithToggle: ({ code }: { code: string }) => (
    <div data-testid="mermaid" data-code={code} />
  ),
}));

vi.mock('../../src/components/Chart/ChartWithToggle', () => ({
  ChartWithToggle: ({ code }: { code: string }) => (
    <div data-testid="chart" data-code={code} />
  ),
}));

vi.mock('../../src/components/Svg/SvgWithToggle', () => ({
  SvgWithToggle: ({ code }: { code: string }) => (
    <div data-testid="svg-toggle" data-code={code} />
  ),
}));

vi.mock('../../src/hooks/useInterUseCases', () => ({
  default: () => ({
    setCopyTemporary: vi.fn(),
  }),
}));

vi.mock('copy-to-clipboard', () => ({
  default: vi.fn(),
}));

beforeEach(() => {
  vi.clearAllMocks();
  mockIsS3Url.mockReturnValue(false);
  mockGetFileDownloadSignedUrl.mockResolvedValue(
    'https://signed-url.example.com/file'
  );
});

describe('Markdown - Characterization Tests', () => {
  describe('Plain text and paragraphs', () => {
    it('renders plain text as a paragraph', () => {
      render(<Markdown>Hello World</Markdown>);
      expect(screen.getByText('Hello World')).toBeTruthy();
    });

    it('renders multiple paragraphs', () => {
      render(<Markdown>{'First\n\nSecond'}</Markdown>);
      expect(screen.getByText('First')).toBeTruthy();
      expect(screen.getByText('Second')).toBeTruthy();
    });
  });

  describe('Links', () => {
    it('renders external link with target=_blank', () => {
      render(<Markdown>{'[Click me](https://example.com)'}</Markdown>);
      const link = screen.getByText('Click me');
      const anchor = link.closest('a');
      expect(anchor?.getAttribute('href')).toBe('https://example.com');
      expect(anchor?.getAttribute('target')).toBe('_blank');
      expect(anchor?.getAttribute('rel')).toBe('noreferrer');
    });

    it('renders anchor link with target=_self', () => {
      render(<Markdown>{'[Section](#section-1)'}</Markdown>);
      const link = screen.getByText('Section');
      const anchor = link.closest('a');
      expect(anchor?.getAttribute('href')).toBe('#section-1');
      expect(anchor?.getAttribute('target')).toBe('_self');
    });

    it('renders S3 link as clickable without href', () => {
      mockIsS3Url.mockImplementation(
        (url: string) => url.includes('s3') && url.includes('amazonaws.com')
      );

      render(
        <Markdown>
          {'[Download](https://bucket.s3.amazonaws.com/file.pdf)'}
        </Markdown>
      );

      const link = screen.getByText('Download');
      const anchor = link.closest('a');
      expect(anchor?.getAttribute('href')).toBeNull();
      expect(anchor?.className).toContain('cursor-pointer');
    });

    it('calls downloadDoc on S3 link click', () => {
      mockIsS3Url.mockImplementation(
        (url: string) => url.includes('s3') && url.includes('amazonaws.com')
      );

      render(
        <Markdown>
          {'[Download](https://bucket.s3.amazonaws.com/file.pdf)'}
        </Markdown>
      );

      screen.getByText('Download').closest('a')!.click();

      expect(mockDownloadDoc).toHaveBeenCalledWith(
        'https://bucket.s3.amazonaws.com/file.pdf',
        'default'
      );
    });
  });

  describe('Images', () => {
    it('renders image with src', () => {
      render(
        <Markdown>{'![alt text](https://example.com/image.png)'}</Markdown>
      );
      const img = document.querySelector('img');
      expect(img).toBeTruthy();
      expect(img?.getAttribute('src')).toBe('https://example.com/image.png');
    });

    it('resolves S3 image via signed URL', async () => {
      mockIsS3Url.mockImplementation(
        (url: string) => url.includes('s3') && url.includes('amazonaws.com')
      );
      mockGetFileDownloadSignedUrl.mockResolvedValue(
        'https://signed.example.com/resolved.png'
      );

      render(
        <Markdown>
          {'![alt](https://bucket.s3.amazonaws.com/image.png)'}
        </Markdown>
      );

      await waitFor(() => {
        const img = document.querySelector('img');
        expect(img?.getAttribute('src')).toBe(
          'https://signed.example.com/resolved.png'
        );
      });
    });
  });

  describe('Code blocks', () => {
    it('renders inline code in a span', () => {
      render(<Markdown>{'Use `console.log` to debug'}</Markdown>);
      expect(screen.getByText('console.log')).toBeTruthy();
      const codeEl = screen.getByText('console.log');
      expect(codeEl.tagName).toBe('SPAN');
    });

    it('renders code block with language label', () => {
      render(
        <Markdown>{'```javascript\nconsole.log("hello");\n```'}</Markdown>
      );
      expect(screen.getByText('javascript')).toBeTruthy();
    });

    it('renders code block without language as plain block', () => {
      render(<Markdown>{'```\nline one\nline two\n```'}</Markdown>);
      expect(screen.getByText('line one')).toBeTruthy();
      expect(screen.getByText('line two')).toBeTruthy();
    });

    it('renders python code block with language label', () => {
      render(<Markdown>{'```python\nprint("hello")\n```'}</Markdown>);
      expect(screen.getByText('python')).toBeTruthy();
    });
  });

  describe('Mermaid diagrams', () => {
    it('renders mermaid code block via MermaidWithToggle', () => {
      render(<Markdown>{'```mermaid\ngraph TD; A-->B;\n```'}</Markdown>);
      expect(screen.getByTestId('mermaid')).toBeTruthy();
      expect(screen.getByTestId('mermaid').dataset.code).toBe(
        'graph TD; A-->B;'
      );
    });
  });

  describe('Chart blocks', () => {
    it('renders chart code block via ChartWithToggle', () => {
      render(
        <Markdown>
          {'```chart\n{"type":"bar","data":[{"name":"A","value":10}]}\n```'}
        </Markdown>
      );
      expect(screen.getByTestId('chart')).toBeTruthy();
    });
  });

  describe('SVG blocks', () => {
    it('renders svg code block via SvgWithToggle', () => {
      render(
        <Markdown>
          {
            '```svg\n<svg xmlns="http://www.w3.org/2000/svg"><circle r="10"/></svg>\n```'
          }
        </Markdown>
      );
      expect(screen.getByTestId('svg-toggle')).toBeTruthy();
    });
  });

  describe('Superscript', () => {
    it('renders sup with styled background', () => {
      const { container } = render(
        <Markdown>{'Text with^superscript^'}</Markdown>
      );
      expect(container.textContent).toContain('Text');
    });
  });

  describe('Props', () => {
    it('passes className to wrapper with prose', () => {
      const { container } = render(
        <Markdown className="custom-class">Hello</Markdown>
      );
      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeTruthy();
      expect(wrapper?.classList.contains('prose')).toBe(true);
    });

    it('applies prose class by default', () => {
      const { container } = render(<Markdown>Hello</Markdown>);
      expect(container.querySelector('.prose')).toBeTruthy();
    });
  });

  describe('GFM support', () => {
    it('renders tables', () => {
      render(
        <Markdown>
          {'| Header 1 | Header 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |'}
        </Markdown>
      );
      expect(document.querySelector('table')).toBeTruthy();
      expect(screen.getByText('Header 1')).toBeTruthy();
      expect(screen.getByText('Cell 1')).toBeTruthy();
    });

    it('renders strikethrough', () => {
      render(<Markdown>{'~~deleted~~'}</Markdown>);
      const del = document.querySelector('del');
      expect(del).toBeTruthy();
      expect(del?.textContent).toBe('deleted');
    });
  });

  describe('Line breaks', () => {
    it('renders hard breaks from single newlines', () => {
      const { container } = render(<Markdown>{'Line one\nLine two'}</Markdown>);
      expect(container.querySelector('br')).toBeTruthy();
    });
  });
});
