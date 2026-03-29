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

const fetcher = async (url: string) => {
  return (await api.get(url)).data;
};

type ErrorProcess = (err: unknown) => void;

const processHttpError = (errorProcess?: ErrorProcess) => (err: unknown) => {
  if (errorProcess) {
    errorProcess(err);
  }

  throw err;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useGet = <Data = any, Error = any>(
  url: string | null,
  config?: SWRConfiguration
) => {
  return useSWR<Data, Error>(url, fetcher, config);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const useGetPagination = <Data = any, Error = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getKey: (pageIndex: number, previousPageData: any) => string | null,
  config?: SWRConfiguration
) => {
  return useSWRInfinite<Data, Error>(getKey, fetcher, config);
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
    get: useGet,

    getPagination: useGetPagination,

    /**
     * POST Request
     * @param url
     * @param data
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    post: <RES = any, DATA = any>(
      url: string,
      data: DATA,
      reqConfig?: AxiosRequestConfig,
      errorProcess?: ErrorProcess
    ): Promise<AxiosResponse<RES>> => {
      return api
        .post<RES, AxiosResponse<RES>, DATA>(url, data, reqConfig)
        .catch(processHttpError(errorProcess));
    },

    /**
     * PUT Request
     * @param url
     * @param data
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    put: <RES = any, DATA = any>(
      url: string,
      data: DATA,
      errorProcess?: ErrorProcess
    ): Promise<AxiosResponse<RES>> => {
      return api
        .put<RES, AxiosResponse<RES>, DATA>(url, data)
        .catch(processHttpError(errorProcess));
    },
    /**
     * DELETE Request
     * @param url
     * @returns
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete: <RES = any, DATA = any>(
      url: string,
      errorProcess?: ErrorProcess
    ): Promise<AxiosResponse<RES>> => {
      return api
        .delete<RES, AxiosResponse<RES>, DATA>(url)
        .catch(processHttpError(errorProcess));
    },
  };
};

export default useHttp;
