import { describe, it, expect, beforeEach } from 'vitest';
import { StrandsStreamProcessor } from '../../src/utils/strandsUtils';

describe('StrandsStreamProcessor', () => {
  let processor: StrandsStreamProcessor;

  beforeEach(() => {
    processor = new StrandsStreamProcessor();
  });

  describe('createChart toolUse handling', () => {
    it('should output chart format for createChart toolUse', () => {
      const chartJson =
        '{"type":"bar","data":{"labels":["A","B"],"values":[1,2]}}';

      const startEvent = JSON.stringify({
        event: {
          contentBlockStart: {
            start: {
              toolUse: { name: 'createChart', toolUseId: 'tu-1' },
            },
          },
        },
      });
      const startResult = processor.processEvent(startEvent);
      expect(startResult).toEqual({ text: '', trace: '' });

      const deltaEvent1 = JSON.stringify({
        event: {
          contentBlockDelta: {
            delta: { toolUse: { input: chartJson.substring(0, 20) } },
          },
        },
      });
      const deltaResult1 = processor.processEvent(deltaEvent1);
      expect(deltaResult1).toEqual({ text: '', trace: '' });

      const deltaEvent2 = JSON.stringify({
        event: {
          contentBlockDelta: {
            delta: { toolUse: { input: chartJson.substring(20) } },
          },
        },
      });
      const deltaResult2 = processor.processEvent(deltaEvent2);
      expect(deltaResult2).toEqual({ text: '', trace: '' });

      const stopEvent = JSON.stringify({
        event: { contentBlockStop: {} },
      });
      const stopResult = processor.processEvent(stopEvent);
      expect(stopResult).toEqual({
        text: '\n```chart\n' + chartJson + '\n```\n',
        trace: '',
      });
    });

    it('should use original format for non-createChart toolUse', () => {
      const toolInput = '{"query":"search term"}';

      const startEvent = JSON.stringify({
        event: {
          contentBlockStart: {
            start: {
              toolUse: { name: 'searchTool', toolUseId: 'tu-2' },
            },
          },
        },
      });
      const startResult = processor.processEvent(startEvent);
      expect(startResult).toEqual({ text: '', trace: '```searchTool\n' });

      const deltaEvent = JSON.stringify({
        event: {
          contentBlockDelta: {
            delta: { toolUse: { input: toolInput } },
          },
        },
      });
      const deltaResult = processor.processEvent(deltaEvent);
      expect(deltaResult).toEqual({ text: '', trace: toolInput });

      const stopEvent = JSON.stringify({
        event: { contentBlockStop: {} },
      });
      const stopResult = processor.processEvent(stopEvent);
      expect(stopResult).toEqual({ text: '', trace: '\n```\n' });
    });

    it('should handle multiple createChart calls with state reset', () => {
      const chartJson1 = '{"type":"line","data":{"x":[1,2],"y":[3,4]}}';
      const chartJson2 =
        '{"type":"pie","data":{"labels":["X","Y"],"values":[50,50]}}';

      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'createChart', toolUseId: 'tu-3' } },
            },
          },
        })
      );
      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockDelta: {
              delta: { toolUse: { input: chartJson1 } },
            },
          },
        })
      );
      const stopResult1 = processor.processEvent(
        JSON.stringify({
          event: { contentBlockStop: {} },
        })
      );
      expect(stopResult1).toEqual({
        text: '\n```chart\n' + chartJson1 + '\n```\n',
        trace: '',
      });

      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'createChart', toolUseId: 'tu-4' } },
            },
          },
        })
      );
      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockDelta: {
              delta: { toolUse: { input: chartJson2 } },
            },
          },
        })
      );
      const stopResult2 = processor.processEvent(
        JSON.stringify({
          event: { contentBlockStop: {} },
        })
      );
      expect(stopResult2).toEqual({
        text: '\n```chart\n' + chartJson2 + '\n```\n',
        trace: '',
      });
    });

    it('should handle invalid/incomplete JSON without validation', () => {
      const invalidJson = '{"type":"bar", invalid';

      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'createChart', toolUseId: 'tu-5' } },
            },
          },
        })
      );
      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockDelta: {
              delta: { toolUse: { input: invalidJson } },
            },
          },
        })
      );
      const stopResult = processor.processEvent(
        JSON.stringify({
          event: { contentBlockStop: {} },
        })
      );

      expect(stopResult).toEqual({
        text: '\n```chart\n' + invalidJson + '\n```\n',
        trace: '',
      });
    });

    it('should handle mixed toolUse types in sequence', () => {
      const chartJson = '{"type":"area","data":{}}';
      const searchInput = '{"q":"test"}';

      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'createChart', toolUseId: 'tu-6' } },
            },
          },
        })
      );
      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockDelta: {
              delta: { toolUse: { input: chartJson } },
            },
          },
        })
      );
      const chartStop = processor.processEvent(
        JSON.stringify({
          event: { contentBlockStop: {} },
        })
      );
      expect(chartStop).toEqual({
        text: '\n```chart\n' + chartJson + '\n```\n',
        trace: '',
      });

      const searchStart = processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'searchTool', toolUseId: 'tu-7' } },
            },
          },
        })
      );
      expect(searchStart).toEqual({ text: '', trace: '```searchTool\n' });

      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockDelta: {
              delta: { toolUse: { input: searchInput } },
            },
          },
        })
      );
      const searchStop = processor.processEvent(
        JSON.stringify({
          event: { contentBlockStop: {} },
        })
      );
      expect(searchStop).toEqual({ text: '', trace: '\n```\n' });
    });

    it('should reset tool name on reset()', () => {
      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'createChart', toolUseId: 'tu-8' } },
            },
          },
        })
      );

      processor.reset();

      const startResult = processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'otherTool', toolUseId: 'tu-9' } },
            },
          },
        })
      );
      expect(startResult).toEqual({ text: '', trace: '```otherTool\n' });
    });

    it('should handle empty createChart input', () => {
      processor.processEvent(
        JSON.stringify({
          event: {
            contentBlockStart: {
              start: { toolUse: { name: 'createChart', toolUseId: 'tu-10' } },
            },
          },
        })
      );
      const stopResult = processor.processEvent(
        JSON.stringify({
          event: { contentBlockStop: {} },
        })
      );
      expect(stopResult).toEqual({
        text: '\n```chart\n\n```\n',
        trace: '',
      });
    });
  });
});
