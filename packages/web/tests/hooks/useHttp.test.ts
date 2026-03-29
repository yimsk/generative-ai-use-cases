import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { AxiosResponse, AxiosRequestConfig } from 'axios';

// Store mock functions in a mutable object that can be accessed by mock factories
const mockFns: {
  axiosGet?: ReturnType<typeof vi.fn>;
  axiosPost?: ReturnType<typeof vi.fn>;
  axiosPut?: ReturnType<typeof vi.fn>;
  axiosDelete?: ReturnType<typeof vi.fn>;
  useSWR?: ReturnType<typeof vi.fn>;
  useSWRInfinite?: ReturnType<typeof vi.fn>;
  fetchAuthSession?: ReturnType<typeof vi.fn>;
} = {};

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: (...args: unknown[]) => mockFns.axiosGet!(...args),
      post: (...args: unknown[]) => mockFns.axiosPost!(...args),
      put: (...args: unknown[]) => mockFns.axiosPut!(...args),
      delete: (...args: unknown[]) => mockFns.axiosDelete!(...args),
      interceptors: {
        request: {
          use: vi.fn(),
        },
      },
    })),
  },
  __esModule: true,
}));

// Mock SWR
vi.mock('swr', () => ({
  default: (...args: unknown[]) => mockFns.useSWR!(...args),
  __esModule: true,
}));

vi.mock('swr/infinite', () => ({
  default: (...args: unknown[]) => mockFns.useSWRInfinite!(...args),
  __esModule: true,
}));

// Mock aws-amplify/auth
vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: (...args: unknown[]) => mockFns.fetchAuthSession!(...args),
  __esModule: true,
}));

// Import after mocks
import useHttp from '../../src/hooks/useHttp';

describe('useHttp', () => {
  beforeEach(() => {
    // Initialize mock functions
    mockFns.axiosGet = vi.fn();
    mockFns.axiosPost = vi.fn();
    mockFns.axiosPut = vi.fn();
    mockFns.axiosDelete = vi.fn();
    mockFns.useSWR = vi.fn();
    mockFns.useSWRInfinite = vi.fn();
    mockFns.fetchAuthSession = vi.fn().mockResolvedValue({
      tokens: {
        idToken: {
          toString: () => 'mock-token',
        },
      },
    });
  });

  describe('get', () => {
    it('should call useSWR with correct parameters', () => {
      const mockSWRResult = {
        data: { id: 1, name: 'Test' },
        error: null,
        isLoading: false,
      };
      mockFns.useSWR!.mockReturnValue(mockSWRResult);

      const { result } = renderHook(() => useHttp());
      const swrResult = result.current.get<{ id: number; name: string }>(
        '/api/test'
      );

      expect(mockFns.useSWR).toHaveBeenCalledWith(
        '/api/test',
        expect.any(Function),
        undefined
      );
      expect(swrResult).toEqual(mockSWRResult);
    });

    it('should pass config to useSWR', () => {
      const mockSWRResult = { data: null, error: null, isLoading: true };
      mockFns.useSWR!.mockReturnValue(mockSWRResult);

      const { result } = renderHook(() => useHttp());
      const config = { revalidateOnFocus: false };
      result.current.get('/api/test', config);

      expect(mockFns.useSWR).toHaveBeenCalledWith(
        '/api/test',
        expect.any(Function),
        config
      );
    });

    it('should handle null url', () => {
      const mockSWRResult = { data: undefined, error: null, isLoading: false };
      mockFns.useSWR!.mockReturnValue(mockSWRResult);

      const { result } = renderHook(() => useHttp());
      const swrResult = result.current.get<string>(null);

      expect(mockFns.useSWR).toHaveBeenCalledWith(
        null,
        expect.any(Function),
        undefined
      );
      expect(swrResult.data).toBeUndefined();
    });

    it('should return error when SWR returns error', () => {
      const mockError = new Error('Network error');
      mockFns.useSWR!.mockReturnValue({
        data: null,
        error: mockError,
        isLoading: false,
      });

      const { result } = renderHook(() => useHttp());
      const swrResult = result.current.get('/api/test');

      expect(swrResult.error).toBe(mockError);
      expect(swrResult.data).toBeNull();
    });
  });

  describe('getPagination', () => {
    it('should call useSWRInfinite with correct parameters', () => {
      const mockSWRInfiniteResult = {
        data: [[{ id: 1 }], [{ id: 2 }]],
        error: null,
        isLoading: false,
        size: 2,
        setSize: vi.fn(),
      };
      mockFns.useSWRInfinite!.mockReturnValue(mockSWRInfiniteResult);

      const getKey = (pageIndex: number) => `api/page/${pageIndex}`;
      const { result } = renderHook(() => useHttp());
      const swrResult = result.current.getPagination<{ id: number }[]>(getKey);

      expect(mockFns.useSWRInfinite).toHaveBeenCalledWith(
        getKey,
        expect.any(Function),
        undefined
      );
      expect(swrResult).toEqual(mockSWRInfiniteResult);
    });

    it('should pass config to useSWRInfinite', () => {
      mockFns.useSWRInfinite!.mockReturnValue({
        data: [],
        error: null,
        isLoading: false,
        size: 0,
        setSize: vi.fn(),
      });

      const getKey = () => 'api/test';
      const { result } = renderHook(() => useHttp());
      const config = { revalidateIfStale: false };
      result.current.getPagination(getKey, config);

      expect(mockFns.useSWRInfinite).toHaveBeenCalledWith(
        getKey,
        expect.any(Function),
        config
      );
    });
  });

  describe('post', () => {
    it('should return Promise<AxiosResponse> on success', async () => {
      const mockResponse: AxiosResponse = {
        data: { id: 1, created: true },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosPost!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const postPromise = result.current.post<{ id: number; created: boolean }>(
        '/api/items',
        { name: 'Test' }
      );

      await expect(postPromise).resolves.toEqual(mockResponse);
      expect(mockFns.axiosPost).toHaveBeenCalledWith(
        '/api/items',
        { name: 'Test' },
        undefined
      );
    });

    it('should pass request config to axios', async () => {
      const mockResponse: AxiosResponse = {
        data: {},
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosPost!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const reqConfig: AxiosRequestConfig = { timeout: 5000 };
      await result.current.post('/api/items', {}, reqConfig);

      expect(mockFns.axiosPost).toHaveBeenCalledWith(
        '/api/items',
        {},
        reqConfig
      );
    });

    it('should call errorProcess callback on error', async () => {
      const mockError = new Error('Request failed');
      mockFns.axiosPost!.mockRejectedValue(mockError);

      const errorProcess = vi.fn();
      const { result } = renderHook(() => useHttp());

      await expect(
        result.current.post('/api/items', {}, undefined, errorProcess)
      ).rejects.toThrow('Request failed');

      expect(errorProcess).toHaveBeenCalledWith(mockError);
    });

    it('should reject without errorProcess on error', async () => {
      const mockError = new Error('Request failed');
      mockFns.axiosPost!.mockRejectedValue(mockError);

      const { result } = renderHook(() => useHttp());

      await expect(result.current.post('/api/items', {})).rejects.toThrow(
        'Request failed'
      );
    });

    it('should handle typed response data', async () => {
      interface CreateResponse {
        id: string;
        timestamp: number;
      }

      const mockResponse: AxiosResponse<CreateResponse> = {
        data: { id: 'abc-123', timestamp: 1234567890 },
        status: 201,
        statusText: 'Created',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosPost!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const response = await result.current.post<CreateResponse>(
        '/api/items',
        {}
      );

      expect(response.data.id).toBe('abc-123');
      expect(response.data.timestamp).toBe(1234567890);
    });
  });

  describe('put', () => {
    it('should return Promise<AxiosResponse> on success', async () => {
      const mockResponse: AxiosResponse = {
        data: { updated: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosPut!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const putPromise = result.current.put<{ updated: boolean }>(
        '/api/items/1',
        { name: 'Updated' }
      );

      await expect(putPromise).resolves.toEqual(mockResponse);
      expect(mockFns.axiosPut).toHaveBeenCalledWith('/api/items/1', {
        name: 'Updated',
      });
    });

    it('should call errorProcess callback on error', async () => {
      const mockError = new Error('Update failed');
      mockFns.axiosPut!.mockRejectedValue(mockError);

      const errorProcess = vi.fn();
      const { result } = renderHook(() => useHttp());

      await expect(
        result.current.put('/api/items/1', {}, errorProcess)
      ).rejects.toThrow('Update failed');

      expect(errorProcess).toHaveBeenCalledWith(mockError);
    });

    it('should handle typed request and response', async () => {
      interface UpdateRequest {
        name: string;
        count: number;
      }
      interface UpdateResponse {
        success: boolean;
      }

      const mockResponse: AxiosResponse<UpdateResponse> = {
        data: { success: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosPut!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const data: UpdateRequest = { name: 'Test', count: 5 };
      const response = await result.current.put<UpdateResponse, UpdateRequest>(
        '/api/items/1',
        data
      );

      expect(response.data.success).toBe(true);
      expect(mockFns.axiosPut).toHaveBeenCalledWith('/api/items/1', data);
    });
  });

  describe('delete', () => {
    it('should return Promise<AxiosResponse> on success', async () => {
      const mockResponse: AxiosResponse = {
        data: { deleted: true },
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosDelete!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const deletePromise = result.current.delete<{ deleted: boolean }>(
        '/api/items/1'
      );

      await expect(deletePromise).resolves.toEqual(mockResponse);
      expect(mockFns.axiosDelete).toHaveBeenCalledWith('/api/items/1');
    });

    it('should call errorProcess callback on error', async () => {
      const mockError = new Error('Delete failed');
      mockFns.axiosDelete!.mockRejectedValue(mockError);

      const errorProcess = vi.fn();
      const { result } = renderHook(() => useHttp());

      await expect(
        result.current.delete('/api/items/1', errorProcess)
      ).rejects.toThrow('Delete failed');

      expect(errorProcess).toHaveBeenCalledWith(mockError);
    });

    it('should handle void response type', async () => {
      const mockResponse: AxiosResponse<void> = {
        data: undefined,
        status: 204,
        statusText: 'No Content',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosDelete!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const response = await result.current.delete<void>('/api/items/1');

      expect(response.status).toBe(204);
      expect(response.data).toBeUndefined();
    });
  });

  describe('api instance', () => {
    it('should expose axios instance for direct use', () => {
      const { result } = renderHook(() => useHttp());
      expect(result.current.api).toBeDefined();
      expect(typeof result.current.api.get).toBe('function');
    });

    it('should allow direct axios get calls', async () => {
      const mockResponse: AxiosResponse = {
        data: { items: [] },
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as AxiosRequestConfig,
      };
      mockFns.axiosGet!.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useHttp());
      const response = await result.current.api.get('/api/items');

      expect(response.data).toEqual({ items: [] });
    });
  });

  describe('error/data coexistence', () => {
    it('should allow both data and error to coexist in SWR response', () => {
      const mockSWRResult = {
        data: { cached: true },
        error: new Error('Refresh failed'),
        isLoading: false,
        isValidating: true,
      };
      mockFns.useSWR!.mockReturnValue(mockSWRResult);

      const { result } = renderHook(() => useHttp());
      const swrResult = result.current.get('/api/test');

      expect(swrResult.data).toEqual({ cached: true });
      expect(swrResult.error).toBeInstanceOf(Error);
    });
  });
});
