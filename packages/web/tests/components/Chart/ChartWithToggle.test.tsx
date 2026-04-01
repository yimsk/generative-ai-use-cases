import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartWithToggle } from '../../../src/components/Chart/ChartWithToggle';

const invalidDataLabel = 'chart.invalid_data';

const mockChartInstance = {
  getDataURL: vi.fn(() => 'data:image/svg+xml;base64,chart'),
  resize: vi.fn(),
  dispose: vi.fn(),
  setOption: vi.fn(),
};

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
  default: ({ onChartInit }: { onChartInit?: (instance: unknown) => void }) => {
    if (onChartInit) {
      onChartInit(mockChartInstance);
    }

    return (
      <div data-testid="echarts-renderer">
        <div
          data-testid="echarts-container"
          style={{ width: '100%', height: 300 }}
        />
      </div>
    );
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

const validScatterChartJson = JSON.stringify({
  type: 'scatter',
  title: 'Scatter Chart',
  data: [
    { name: 'A', value: [1, 2] },
    { name: 'B', value: [3, 4] },
    { name: 'C', value: [5, 6] },
  ],
});

const invalidJson = 'not valid json {{{';
const invalidChartDataJson = JSON.stringify({ foo: 'bar' });

describe('ChartWithToggle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockChartInstance.getDataURL.mockClear();
    mockChartInstance.resize.mockClear();
    mockChartInstance.dispose.mockClear();
    mockChartInstance.setOption.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders chart view immediately with valid data', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    expect(screen.getByTestId('chart-panel').className).toContain('visible');
    expect(screen.getByTestId('echarts-renderer')).toBeTruthy();
  });

  it('shows chart view by default when data is valid', () => {
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
    expect(mockChartInstance.resize).toHaveBeenCalled();
  });

  it('shows code view for invalid JSON', () => {
    render(<ChartWithToggle code={invalidJson} />);

    expect(screen.getByTestId('code-panel').className).toContain('visible');
  });

  it('does not re-parse JSON on rerender with the same input', () => {
    const parseSpy = vi.spyOn(JSON, 'parse');

    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByText('chart.view_code'));
    fireEvent.click(screen.getByText('chart.view_chart'));

    expect(parseSpy).toHaveBeenCalledTimes(1);

    parseSpy.mockRestore();
  });

  it('renders SVG download button and downloads via chart instance from callback', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByTitle('chart.download_svg'));

    expect(mockChartInstance.getDataURL).toHaveBeenCalledWith({
      type: 'svg',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);

    clickSpy.mockRestore();
  });

  it('renders scatter charts without visible labels and keeps zoom/download wiring', () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {});

    render(<ChartWithToggle code={validScatterChartJson} />);

    expect(screen.getByTestId('chart-panel').className).toContain('visible');
    expect(screen.getByTestId('code-panel').className).not.toMatch(
      /(^|\s)visible(\s|$)/
    );
    expect(screen.getByTestId('echarts-renderer')).toBeTruthy();
    expect(screen.queryByText(invalidDataLabel)).toBeNull();

    fireEvent.click(screen.getByTitle('Zoom chart'));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId('chart-zoom-modal')).toBeTruthy();
    expect(mockChartInstance.resize).toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('chart.download_svg'));

    expect(mockChartInstance.getDataURL).toHaveBeenCalledWith({
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

  it('shows code view for valid json with invalid chart data', () => {
    render(<ChartWithToggle code={invalidChartDataJson} />);

    expect(screen.getByTestId('code-panel').className).toContain('visible');
  });

  it('opens zoom modal and closes on escape', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByTitle('Zoom chart'));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId('chart-zoom-modal')).toBeTruthy();
    expect(mockChartInstance.resize).toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(screen.queryByTestId('chart-zoom-modal')).toBeNull();
  });

  it('receives chart instance via onChartInit callback from EChartsRenderer', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    expect(mockChartInstance.getDataURL).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTitle('chart.download_svg'));

    expect(mockChartInstance.getDataURL).toHaveBeenCalledWith({
      type: 'svg',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
  });

  it('uses zoom chart instance for download when zoom modal is open', () => {
    render(<ChartWithToggle code={validBarChartJson} />);

    fireEvent.click(screen.getByTitle('Zoom chart'));

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId('chart-zoom-modal')).toBeTruthy();

    fireEvent.click(screen.getByTitle('chart.download_svg'));

    expect(mockChartInstance.getDataURL).toHaveBeenCalledWith({
      type: 'svg',
      pixelRatio: 2,
      backgroundColor: '#fff',
    });
  });

  describe('streaming scenarios', () => {
    it('shows loading state when code is empty', () => {
      render(<ChartWithToggle code="" />);

      expect(screen.getByTestId('code-panel').className).toContain('visible');
      expect(screen.getByText('chart.loading')).toBeTruthy();
    });

    it('switches to chart view when valid data arrives', () => {
      const { rerender } = render(<ChartWithToggle code="" />);

      expect(screen.getByTestId('code-panel').className).toContain('visible');

      rerender(<ChartWithToggle code={validBarChartJson} />);

      expect(screen.getByTestId('chart-panel').className).toContain('visible');
      expect(screen.getByTestId('echarts-renderer')).toBeTruthy();
    });

    it('stays in code view when data is invalid JSON', () => {
      render(<ChartWithToggle code={invalidJson} />);

      expect(screen.getByTestId('code-panel').className).toContain('visible');
    });

    it('stays in code view when data is valid JSON but invalid chart data', () => {
      render(<ChartWithToggle code={invalidChartDataJson} />);

      expect(screen.getByTestId('code-panel').className).toContain('visible');
    });

    it('manual toggle to chart works with invalid data', () => {
      render(<ChartWithToggle code={invalidJson} />);

      expect(screen.getByTestId('code-panel').className).toContain('visible');

      fireEvent.click(screen.getByText('chart.view_chart'));

      expect(screen.getByTestId('chart-panel').className).toContain('visible');
    });

    it('manual toggle to code works with valid data', () => {
      render(<ChartWithToggle code={validBarChartJson} />);

      expect(screen.getByTestId('chart-panel').className).toContain('visible');

      fireEvent.click(screen.getByText('chart.view_code'));

      expect(screen.getByTestId('code-panel').className).toContain('visible');
    });

    it('resets manual override when code changes', () => {
      const { rerender } = render(<ChartWithToggle code={validBarChartJson} />);

      fireEvent.click(screen.getByText('chart.view_code'));
      expect(screen.getByTestId('code-panel').className).toContain('visible');

      const newValidData = JSON.stringify({
        type: 'line',
        title: 'New Chart',
        data: [{ name: 'X', value: 100 }],
      });
      rerender(<ChartWithToggle code={newValidData} />);

      expect(screen.getByTestId('chart-panel').className).toContain('visible');
    });
  });
});
