import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as echarts from 'echarts';
import EChartsRenderer from '../../../src/components/Chart/EChartsRenderer';

const prefectureName = 'Tokyo';
const municipalityName = 'Shinjuku';

const mockFetch = vi.fn();
global.fetch = mockFetch as typeof fetch;
let getBoundingClientRectSpy: ReturnType<typeof vi.spyOn>;

const {
  mockSetOption,
  mockResize,
  mockDispose,
  mockGetDataURL,
  mockInit,
  mockRegisterMap,
} = vi.hoisted(() => {
  const setOption = vi.fn();
  const resize = vi.fn();
  const dispose = vi.fn();
  const getDataURL = vi.fn(() => 'data:image/svg+xml;base64,...');
  const init = vi.fn(() => ({
    setOption,
    resize,
    dispose,
    getDataURL,
  }));
  const registerMap = vi.fn();

  return {
    mockSetOption: setOption,
    mockResize: resize,
    mockDispose: dispose,
    mockGetDataURL: getDataURL,
    mockInit: init,
    mockRegisterMap: registerMap,
  };
});

vi.mock('echarts', () => ({
  init: mockInit,
  registerMap: mockRegisterMap,
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const singleSeriesData = {
  type: 'bar',
  data: [
    { name: 'A', value: 10 },
    { name: 'B', value: 20 },
    { name: 'C', value: 30 },
  ],
};

const multiSeriesData = {
  type: 'bar',
  series: [
    {
      name: 'Series1',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
      ],
    },
    {
      name: 'Series2',
      data: [
        { name: 'A', value: 15 },
        { name: 'B', value: 25 },
      ],
    },
  ],
};

const reorderedMultiSeriesData = {
  type: 'line',
  series: [
    {
      name: 'Series1',
      data: [
        { name: 'A', value: 10 },
        { name: 'B', value: 20 },
        { name: 'C', value: 30 },
      ],
    },
    {
      name: 'Series2',
      data: [
        { name: 'B', value: 200 },
        { name: 'A', value: 100 },
        { name: 'D', value: 400 },
      ],
    },
  ],
};

const duplicateCategorySeriesData = {
  type: 'bar',
  series: [
    {
      name: 'Series1',
      data: [
        { name: 'A', value: 10 },
        { name: 'A', value: 20 },
      ],
    },
    {
      name: 'Series2',
      data: [{ name: 'A', value: 30 }],
    },
  ],
};

const boxplotData = {
  type: 'boxplot',
  labels: ['A', 'B'],
  data: [
    [1, 2, 3, 4, 5],
    [2, 3, 4, 5, 6],
  ],
};

const heatmapData = {
  type: 'heatmap',
  xLabels: ['Mon', 'Tue'],
  yLabels: ['AM', 'PM'],
  data: [
    [0, 0, 5],
    [1, 1, 9],
  ],
};

const radarData = {
  type: 'radar',
  indicators: [
    { name: 'Speed', max: 100 },
    { name: 'Reliability', max: 100 },
  ],
  data: [
    { name: 'Model A', value: [80, 90] },
    { name: 'Model B', value: [70, 85] },
  ],
};

const candlestickData = {
  type: 'candlestick',
  dates: ['2024-01-01', '2024-01-02'],
  data: [
    [20, 25, 18, 27],
    [25, 22, 21, 28],
  ],
};

const scatterData = {
  type: 'scatter',
  data: [
    { name: 'A', value: [10, 20] },
    { name: 'B', value: [20, 30] },
    { name: 'C', value: [30, 40] },
  ],
};

const namedTupleScatterData = {
  type: 'scatter',
  xAxisLabel: 'GDP',
  yAxisLabel: 'Population',
  data: [{ name: 'Tokyo', value: [100, 200] }],
};

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('EChartsRenderer', () => {
  beforeEach(() => {
    getBoundingClientRectSpy = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockImplementation(
        () =>
          ({
            width: 640,
            height: 300,
            top: 0,
            right: 640,
            bottom: 300,
            left: 0,
            x: 0,
            y: 0,
            toJSON: () => ({}),
          }) as DOMRect
      );
    mockInit.mockClear();
    mockSetOption.mockClear();
    mockResize.mockClear();
    mockDispose.mockClear();
    mockGetDataURL.mockClear();
    mockRegisterMap.mockClear();
    mockFetch.mockReset();
  });

  afterEach(() => {
    getBoundingClientRectSpy.mockRestore();
  });

  it('renders bar chart with valid single-series JSON', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(singleSeriesData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          color: expect.arrayContaining(['#4e79a7', '#f28e2b']),
          series: [
            expect.objectContaining({ type: 'bar', data: [10, 20, 30] }),
          ],
        }),
        true
      );
    });
  });

  it('renders line chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({ ...singleSeriesData, type: 'line' })}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          series: [
            expect.objectContaining({ type: 'line', data: [10, 20, 30] }),
          ],
        }),
        true
      );
    });
  });

  it('renders pie chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({ ...singleSeriesData, type: 'pie' })}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          series: [
            expect.objectContaining({
              type: 'pie',
              data: [
                { name: 'A', value: 10 },
                { name: 'B', value: 20 },
                { name: 'C', value: 30 },
              ],
            }),
          ],
        }),
        true
      );
    });
  });

  it('renders area chart', async () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({ ...singleSeriesData, type: 'area' })}
      />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          series: [
            expect.objectContaining({
              type: 'line',
              areaStyle: {},
              data: [10, 20, 30],
            }),
          ],
        }),
        true
      );
    });
  });

  it('renders scatter chart', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(scatterData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          series: [
            expect.objectContaining({
              type: 'scatter',
              data: [
                { name: 'A', value: [10, 20] },
                { name: 'B', value: [20, 30] },
                { name: 'C', value: [30, 40] },
              ],
            }),
          ],
        }),
        true
      );
    });
  });

  it('uses item tooltip for named tuple scatter points', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(namedTupleScatterData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          tooltip: expect.objectContaining({
            trigger: 'item',
            formatter: expect.any(Function),
          }),
          series: [
            expect.objectContaining({
              type: 'scatter',
              data: [{ name: 'Tokyo', value: [100, 200] }],
            }),
          ],
        }),
        true
      );

      const option = mockSetOption.mock.calls.at(-1)?.[0] as {
        tooltip?: { formatter?: (params: unknown) => string };
      };
      const formatter = option.tooltip?.formatter;

      expect(formatter).toBeTypeOf('function');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('Tokyo');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('GDP');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('Population');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('100');
      expect(
        formatter?.({
          name: 'Tokyo',
          value: [100, 200],
          data: { name: 'Tokyo', value: [100, 200] },
        })
      ).toContain('200');
    });
  });

  it('renders boxplot chart', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(boxplotData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          xAxis: expect.objectContaining({ data: ['A', 'B'] }),
          series: [
            expect.objectContaining({
              type: 'boxplot',
              data: boxplotData.data,
            }),
          ],
        }),
        true
      );
    });
  });

  it('renders heatmap chart', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(heatmapData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          visualMap: expect.objectContaining({ min: 5, max: 9 }),
          series: [
            expect.objectContaining({
              type: 'heatmap',
              data: heatmapData.data,
            }),
          ],
        }),
        true
      );
    });
  });

  it('renders radar chart', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(radarData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          radar: expect.objectContaining({ indicator: radarData.indicators }),
          series: [
            expect.objectContaining({
              type: 'radar',
              data: radarData.data,
            }),
          ],
        }),
        true
      );
    });
  });

  it('renders candlestick chart', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(candlestickData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          grid: expect.objectContaining({
            left: 64,
            containLabel: true,
          }),
          xAxis: expect.objectContaining({ data: candlestickData.dates }),
          series: [
            expect.objectContaining({
              type: 'candlestick',
              data: candlestickData.data,
            }),
          ],
        }),
        true
      );
    });
  });

  describe('Map chart', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            type: 'FeatureCollection',
            features: [],
          }),
      });
    });

    it('renders prefecture map', async () => {
      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        data: [{ name: prefectureName, value: 13960000 }],
      });

      render(<EChartsRenderer rawJson={mapJson} />);

      expect(screen.getByText('common.loading')).toBeTruthy();

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/geojson/japan-prefectures.geojson'
        );
      });

      await waitFor(() => {
        expect(mockRegisterMap).toHaveBeenCalledWith(
          'japan-prefecture',
          expect.objectContaining({
            type: 'FeatureCollection',
            features: [],
          })
        );
      });

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            series: expect.arrayContaining([
              expect.objectContaining({ type: 'map', map: 'japan-prefecture' }),
            ]),
          }),
          true
        );
      });
    });

    it('renders municipality map', async () => {
      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'municipality',
        prefecture: '13-tokyo',
        data: [{ name: municipalityName, value: 350000 }],
      });

      render(<EChartsRenderer rawJson={mapJson} />);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          '/geojson/prefectures/13-tokyo.geojson'
        );
      });

      await waitFor(() => {
        expect(mockRegisterMap).toHaveBeenCalledWith(
          'japan-municipality-13-tokyo',
          expect.objectContaining({
            type: 'FeatureCollection',
            features: [],
          })
        );
      });

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            series: expect.arrayContaining([
              expect.objectContaining({
                type: 'map',
                map: 'japan-municipality-13-tokyo',
              }),
            ]),
          }),
          true
        );
      });
    });

    it('uses custom map color config when provided', async () => {
      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        min: -16,
        max: 0,
        colorStops: [
          { offset: 1, color: '#0000ff' },
          { offset: 0, color: '#ff0000' },
          { offset: 0.5, color: '#00ff00' },
        ],
        data: [{ name: prefectureName, value: -8 }],
      });

      render(<EChartsRenderer rawJson={mapJson} />);

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            visualMap: expect.objectContaining({
              min: -16,
              max: 0,
              inRange: expect.objectContaining({
                color: ['#ff0000', '#00ff00', '#0000ff'],
              }),
            }),
          }),
          true
        );
      });
    });

    it('rejects invalid custom map color config', () => {
      render(
        <EChartsRenderer
          rawJson={JSON.stringify({
            type: 'map',
            region: 'japan',
            detail: 'prefecture',
            min: -16,
            max: 0,
            colorStops: [
              { offset: 0, color: '#ff0000' },
              { offset: 2, color: '#00ff00' },
            ],
            data: [{ name: prefectureName, value: -8 }],
          })}
        />
      );

      expect(screen.getByText('chart.invalid_data')).toBeTruthy();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockSetOption).not.toHaveBeenCalled();
    });

    it('rejects malformed custom map color config objects', () => {
      render(
        <EChartsRenderer
          rawJson={JSON.stringify({
            type: 'map',
            region: 'japan',
            detail: 'prefecture',
            min: -16,
            max: 0,
            colorStops: [{ offset: 0, color: '#ff0000' }, { color: '#00ff00' }],
            data: [{ name: prefectureName, value: -8 }],
          })}
        />
      );

      expect(screen.getByText('chart.invalid_data')).toBeTruthy();
      expect(mockInit).not.toHaveBeenCalled();
      expect(mockSetOption).not.toHaveBeenCalled();
    });

    it('keeps the chart container mounted while GeoJSON is loading', async () => {
      const jsonDeferred = createDeferred<{
        type: string;
        features: never[];
      }>();

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => jsonDeferred.promise,
      });

      const mapJson = JSON.stringify({
        type: 'map',
        region: 'japan',
        detail: 'prefecture',
        data: [{ name: prefectureName, value: 13960000 }],
      });

      render(<EChartsRenderer rawJson={mapJson} />);

      await waitFor(() => {
        expect(screen.getByTestId('map-loading-overlay')).toBeTruthy();
      });

      expect(screen.getByTestId('echarts-container')).toBeTruthy();
      expect(mockInit).toHaveBeenCalledTimes(1);

      jsonDeferred.resolve({
        type: 'FeatureCollection',
        features: [],
      });

      await waitFor(() => {
        expect(mockSetOption).toHaveBeenCalledWith(
          expect.objectContaining({
            series: expect.arrayContaining([
              expect.objectContaining({ type: 'map', map: 'japan-prefecture' }),
            ]),
          }),
          true
        );
      });

      expect(mockInit).toHaveBeenCalledTimes(1);
    });
  });

  it('renders multi-series chart', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(multiSeriesData)} />);

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          legend: expect.objectContaining({ top: 24 }),
          series: [
            expect.objectContaining({
              name: 'Series1',
              type: 'bar',
              data: [10, 20],
            }),
            expect.objectContaining({
              name: 'Series2',
              type: 'bar',
              data: [15, 25],
            }),
          ],
        }),
        true
      );
    });
  });

  it('normalizes multi-series category charts by category name', async () => {
    render(
      <EChartsRenderer rawJson={JSON.stringify(reorderedMultiSeriesData)} />
    );

    await waitFor(() => {
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          xAxis: expect.objectContaining({ data: ['A', 'B', 'C', 'D'] }),
          series: [
            expect.objectContaining({
              name: 'Series1',
              type: 'line',
              data: [10, 20, 30, null],
            }),
            expect.objectContaining({
              name: 'Series2',
              type: 'line',
              data: [100, 200, null, 400],
            }),
          ],
        }),
        true
      );
    });
  });

  it('rejects ambiguous duplicate category names in a series', async () => {
    render(
      <EChartsRenderer rawJson={JSON.stringify(duplicateCategorySeriesData)} />
    );

    await waitFor(() => {
      expect(screen.getByText('chart.invalid_data')).toBeTruthy();
    });

    expect(mockSetOption).not.toHaveBeenCalled();
  });

  it('shows error for invalid JSON', () => {
    render(<EChartsRenderer rawJson="{invalid}" />);

    expect(screen.getByText('chart.invalid_data')).toBeTruthy();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('shows error for valid JSON but invalid chart data', () => {
    render(<EChartsRenderer rawJson='{"foo":"bar"}' />);

    expect(screen.getByText('chart.invalid_data')).toBeTruthy();
    expect(mockInit).not.toHaveBeenCalled();
  });

  it('initializes when chart data becomes valid after first render', async () => {
    const { rerender } = render(<EChartsRenderer rawJson='{"foo":"bar"}' />);

    expect(mockInit).not.toHaveBeenCalled();

    rerender(<EChartsRenderer rawJson={JSON.stringify(singleSeriesData)} />);

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
      expect(mockSetOption).toHaveBeenCalledWith(
        expect.objectContaining({
          series: [
            expect.objectContaining({ type: 'bar', data: [10, 20, 30] }),
          ],
        }),
        true
      );
    });
  });

  it('renders title when provided', () => {
    render(
      <EChartsRenderer
        rawJson={JSON.stringify({
          ...singleSeriesData,
          title: 'My Chart Title',
        })}
      />
    );

    expect(screen.getByText('My Chart Title')).toBeTruthy();
  });

  it('handles window resize', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(singleSeriesData)} />);

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    mockResize.mockClear();

    window.dispatchEvent(new Event('resize'));

    expect(mockResize).toHaveBeenCalled();
  });

  it('disposes chart instance on unmount', async () => {
    const { unmount } = render(
      <EChartsRenderer rawJson={JSON.stringify(singleSeriesData)} />
    );

    await waitFor(() => {
      expect(mockInit).toHaveBeenCalledTimes(1);
    });

    unmount();

    expect(mockDispose).toHaveBeenCalledTimes(1);
  });

  it('initializes echarts on the chart container', async () => {
    render(<EChartsRenderer rawJson={JSON.stringify(singleSeriesData)} />);

    await waitFor(() => {
      expect(echarts.init).toHaveBeenCalledWith(expect.any(HTMLDivElement));
    });
  });

  describe('onChartInit callback', () => {
    it('calls onChartInit with instance after initialization', async () => {
      const onChartInit = vi.fn();

      render(
        <EChartsRenderer
          rawJson={JSON.stringify(singleSeriesData)}
          onChartInit={onChartInit}
        />
      );

      await waitFor(() => {
        expect(onChartInit).toHaveBeenCalledTimes(1);
        expect(onChartInit).toHaveBeenCalledWith(
          expect.objectContaining({
            setOption: expect.any(Function),
            resize: expect.any(Function),
            dispose: expect.any(Function),
          })
        );
      });
    });

    it('calls onChartInit with null on unmount', async () => {
      const onChartInit = vi.fn();

      const { unmount } = render(
        <EChartsRenderer
          rawJson={JSON.stringify(singleSeriesData)}
          onChartInit={onChartInit}
        />
      );

      await waitFor(() => {
        expect(onChartInit).toHaveBeenCalledTimes(1);
      });

      unmount();

      expect(onChartInit).toHaveBeenCalledWith(null);
      expect(onChartInit).toHaveBeenCalledTimes(2);
    });

    it('does not call onChartInit when not provided', async () => {
      render(<EChartsRenderer rawJson={JSON.stringify(singleSeriesData)} />);

      await waitFor(() => {
        expect(mockInit).toHaveBeenCalledTimes(1);
      });

      expect(mockInit).toHaveBeenCalled();
    });
  });
});
