import { fetchAuthSession } from 'aws-amplify/auth';
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';
import useSWR, { SWRConfiguration } from 'swr';
import useSWRInfinite from 'swr/infinite';

const api = axios.create({
  baseURL: import.meta.env.VITE_APP_API_ENDPOINT,
});

// HTTP Request Preprocessing
api.interceptors.request.use(async (config) => {
  // If Authenticated, append ID Token to Request Header
  const token = (await fetchAuthSession()).tokens?.idToken?.toString();
  if (token) {
    config.headers['Authorization'] = token;
  }

  config.headers['Content-Type'] = 'application/json';

  return config;
});

const fetcher = (url: string) => {
  return api.get(url).then((res) => res.data);
};

/**
 * Hooks for Http Request
 * @returns
 */
const useHttp = () => {
  return {
    api,
    /**
     * GET Request
     * Implemented with SWR
     * @param url
     * @returns
     */
    get: <Data = unknown, Error = unknown>(
      url: string | null,
      config?: SWRConfiguration
    ) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSWR<Data, Error>(url, fetcher, config);
    },

    getPagination: <Data = unknown, Error = unknown>(
      getKey: (
        pageIndex: number,
        previousPageData: Data | null
      ) => string | null,
      config?: SWRConfiguration
    ) => {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSWRInfinite<Data, Error>(getKey, fetcher, config);
    },

    /**
     * POST Request
     * @param url
     * @param data
     * @returns
     */
    post: <RES = unknown, DATA = unknown>(
      url: string,
      data: DATA,
      reqConfig?: AxiosRequestConfig,
      errorProcess?: (err: unknown) => void
    ): Promise<AxiosResponse<RES>> => {
      return api
        .post<RES, AxiosResponse<RES>, DATA>(url, data, reqConfig)
        .catch((err) => {
          if (errorProcess) {
            errorProcess(err);
          }
          throw err;
        });
    },

    /**
     * PUT Request
     * @param url
     * @param data
     * @returns
     */
    put: <RES = unknown, DATA = unknown>(
      url: string,
      data: DATA,
      errorProcess?: (err: unknown) => void
    ): Promise<AxiosResponse<RES>> => {
      return api.put<RES, AxiosResponse<RES>, DATA>(url, data).catch((err) => {
        if (errorProcess) {
          errorProcess(err);
        }
        throw err;
      });
    },
    /**
     * DELETE Request
     * @param url
     * @returns
     */
    delete: <RES = unknown, DATA = unknown>(
      url: string,
      errorProcess?: (err: unknown) => void
    ): Promise<AxiosResponse<RES>> => {
      return api.delete<RES, AxiosResponse<RES>, DATA>(url).catch((err) => {
        if (errorProcess) {
          errorProcess(err);
        }
        throw err;
      });
    },
  };
};

export default useHttp;
