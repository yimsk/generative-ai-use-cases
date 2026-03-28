import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartWithToggle } from '../../../src/components/Chart/ChartWithToggle';

const invalidDataLabel = 'chart.invalid_data';

const { mockGetDataURL, mockResize, mockGetInstanceByDom } = vi.hoisted(() => {
  const getDataURL = vi.fn(() => 'data:image/svg+xml;base64,chart');
  const resize = vi.fn();
  const getInstanceByDom = vi.fn(() => ({
    getDataURL,
    resize,
  }));

  return {
    mockGetDataURL: getDataURL,
    mockResize: resize,
    mockGetInstanceByDom: getInstanceByDom,
  };
});

vi.mock('echarts', () => ({
  getInstanceByDom: mockGetInstanceByDom,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('copy-to-clipboard', () => ({
  default: () => true,
  __esModule: true,
}));

vi.mock('../../../src/hooks/useInterUseCases', () => ({
  default: () => ({
    setCopyTemporary: vi.fn(),
  }),
  __esModule: true,
}));

vi.mock('../../../src/components/Chart/EChartsRenderer', () => ({
  default: ({ rawJson }: { rawJson: string }) => {
    try {
      const parsed = JSON.parse(rawJson) as {
        title?: string;
        type?: string;
        data?: unknown[];
        series?: unknown[];
      };

      const isValid =
        typeof parsed.type === 'string' &&
        (Array.isArray(parsed.data) || Array.isArray(parsed.series));

      if (!isValid) {
        return <div>{invalidDataLabel}</div>;
      }

      return (
        <div data-testid="echarts-renderer">
          {parsed.title ? <h3>{parsed.title}</h3> : null}
          <div
            data-testid="echarts-container"
            style={{ width: '100%', height: 300 }}
          />
        </div>
      );
    } catch {
      return <div>{invalidDataLabel}</div>;
    }
  },
}));

const validBarChartJson = JSON.stringify({
  type: 'bar',
  title: 'Test Chart',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
    { name: 'C', value: 30 },
  ],
});

const invalidJson = 'not valid json {{{';
const invalidChartDataJson = JSON.stringify({ foo: 'bar' });

describe('ChartWithToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    mockGetDataURL.mockClear();
    mockResize.mockClear();
    mockGetInstanceByDom.mockClear();
  });

  it('renders chart view after auto-switch on code change', () => {
    const { rerender } = render(<ChartWithToggle code="" />);

    rerender(<ChartWithToggle code={validBarChartJson} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByTestId('chart-panel').className).toContain('visible');
    expect(screen.getByTestId('echarts-renderer')).toBeTruthy();
  });

  it('shows chart view by default', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    expect(screen.getByText('chart.view_chart')).toBeTruthy();
    expect(screen.getByText('chart.view_code')).toBeTruthy();
    expect(screen.getByTestId('chart-panel').className).toContain('visible');
  });

  it('toggles to code view on button click', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByText('chart.view_code'));

    expect(screen.getByTestId('code-panel').className).toContain('visible');
  });

  it('toggles back to chart view on button click', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByText('chart.view_code'));
    expect(screen.getByTestId('code-panel').className).toContain('visible');

    fireEvent.click(screen.getByText('chart.view_chart'));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId('chart-panel').className).toContain('visible');
    expect(mockResize).toHaveBeenCalled();
  });

  it('shows error for invalid JSON after auto-switch', () => {
    const { rerender } = render(<ChartWithToggle code="" />);

    rerender(<ChartWithToggle code={invalidJson} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText(invalidDataLabel)).toBeTruthy();
    expect(screen.getByTestId('chart-panel').className).toContain('visible');
  });

  it('renders SVG download button and downloads via echarts api', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByTitle('chart.download_svg'));

    expect(mockGetInstanceByDom).toHaveBeenCalledWith(
      expect.any(HTMLDivElement)
    );
    expect(mockGetDataURL).toHaveBeenCalledWith({
      type: 'svg',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('imports component', () => {
    expect(ChartWithToggle).toBeDefined();
  });

  it('shows error for valid json with invalid chart data', () => {
    const { rerender } = render(<ChartWithToggle code="" />);

    rerender(<ChartWithToggle code={invalidChartDataJson} />);

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(screen.getByText(invalidDataLabel)).toBeTruthy();
  });

  it('opens zoom modal and closes on escape', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByTitle('Zoom chart'));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId('chart-zoom-modal')).toBeTruthy();
    expect(mockResize).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('chart-zoom-modal')).toBeNull();
  });
});
