// Ambient declarations for third-party packages when building or running tsc standalone
declare module 'react-router-dom';
declare module 'lucide-react';
declare module 'tailwind-merge';

declare module 'axios' {
  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: any;
  }
  export interface AxiosInstance {
    get<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
    post<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>>;
    put<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>>;
    patch<T = any>(url: string, data?: any, config?: any): Promise<AxiosResponse<T>>;
    delete<T = any>(url: string, config?: any): Promise<AxiosResponse<T>>;
    interceptors: {
      request: { use: (onFulfilled?: any, onRejected?: any) => number };
      response: { use: (onFulfilled?: any, onRejected?: any) => number };
    };
  }
  const axios: {
    create: (config?: any) => AxiosInstance;
  };
  export default axios;
}
