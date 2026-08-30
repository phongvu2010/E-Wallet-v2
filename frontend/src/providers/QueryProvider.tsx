import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

interface QueryOptions<T> {
  staleTime?: number; // default 5 mins
  enabled?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}

interface MutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void | Promise<void>;
  onError?: (error: Error, variables: TVariables) => void;
}

interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
}

class QueryClient {
  private cache = new Map<string, CacheEntry>();
  private subscribers = new Map<string, Set<() => void>>();
  private defaultStaleTime = 5 * 60 * 1000; // 5 mins

  private serializeKey(key: any[] | string): string {
    return Array.isArray(key) ? JSON.stringify(key) : String(key);
  }

  public getQueryData<T>(key: any[] | string): T | undefined {
    const sKey = this.serializeKey(key);
    return this.cache.get(sKey)?.data;
  }

  public setQueryData<T>(key: any[] | string, data: T): void {
    const sKey = this.serializeKey(key);
    this.cache.set(sKey, { data, timestamp: Date.now() });
    this.notify(sKey);
  }

  public async fetchQuery<T>(
    key: any[] | string,
    fetcher: () => Promise<T>,
    staleTime = this.defaultStaleTime
  ): Promise<T> {
    const sKey = this.serializeKey(key);
    const existing = this.cache.get(sKey);

    // If cache exists and is still fresh, return cached data
    if (existing && Date.now() - existing.timestamp < staleTime && existing.data !== undefined) {
      return existing.data;
    }

    // If there's an in-flight promise for this exact key, deduplicate request
    if (existing?.promise) {
      return existing.promise;
    }

    const promise = (async () => {
      try {
        const data = await fetcher();
        this.cache.set(sKey, { data, timestamp: Date.now() });
        this.notify(sKey);
        return data;
      } finally {
        const entry = this.cache.get(sKey);
        if (entry) {
          entry.promise = undefined;
        }
      }
    })();

    if (existing) {
      existing.promise = promise;
    } else {
      this.cache.set(sKey, { data: undefined, timestamp: 0, promise });
    }

    return promise;
  }

  public invalidateQueries(keyFilter?: any[] | string): void {
    const filterStr = keyFilter ? this.serializeKey(keyFilter) : "";
    for (const [k] of this.cache.entries()) {
      if (!filterStr || k.includes(filterStr.replace(/[\[\]]/g, ""))) {
        const entry = this.cache.get(k);
        if (entry) {
          entry.timestamp = 0; // mark stale immediately
        }
        this.notify(k);
      }
    }
  }

  public subscribe(key: any[] | string, callback: () => void): () => void {
    const sKey = this.serializeKey(key);
    if (!this.subscribers.has(sKey)) {
      this.subscribers.set(sKey, new Set());
    }
    this.subscribers.get(sKey)!.add(callback);
    return () => {
      this.subscribers.get(sKey)?.delete(callback);
    };
  }

  private notify(key: string): void {
    this.subscribers.get(key)?.forEach((cb) => cb());
  }
}

export const queryClient = new QueryClient();
const QueryClientContext = createContext<QueryClient>(queryClient);

export const QueryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <QueryClientContext.Provider value={queryClient}>
      {children}
    </QueryClientContext.Provider>
  );
};

export function useQueryClient(): QueryClient {
  return useContext(QueryClientContext);
}

export function useQuery<T>(
  key: any[] | string,
  fetcher: () => Promise<T>,
  options: QueryOptions<T> = {}
) {
  const client = useQueryClient();
  const { staleTime = 5 * 60 * 1000, enabled = true } = options;

  const cachedData = client.getQueryData<T>(key);
  const [data, setData] = useState<T | undefined>(cachedData);
  const [isLoading, setIsLoading] = useState<boolean>(cachedData === undefined && enabled);
  const [isFetching, setIsFetching] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const optionsRef = useRef(options);
  optionsRef.current = options;

  const executeFetch = useCallback(
    async (isBackground = false) => {
      if (!enabled) return;
      if (!isBackground && cachedData === undefined) {
        setIsLoading(true);
      }
      setIsFetching(true);
      setError(null);
      try {
        const result = await client.fetchQuery(key, fetcherRef.current, staleTime);
        setData(result);
        optionsRef.current.onSuccess?.(result);
      } catch (err: any) {
        const e = err instanceof Error ? err : new Error(String(err));
        setError(e);
        optionsRef.current.onError?.(e);
      } finally {
        setIsLoading(false);
        setIsFetching(false);
      }
    },
    [client, JSON.stringify(key), enabled, staleTime]
  );

  useEffect(() => {
    executeFetch();

    // Subscribe to cache invalidation
    const unsubscribe = client.subscribe(key, () => {
      executeFetch(true);
    });

    return () => {
      unsubscribe();
    };
  }, [executeFetch]);

  // Window focus background revalidation
  useEffect(() => {
    const handleFocus = () => {
      executeFetch(true);
    };
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [executeFetch]);

  return {
    data,
    isLoading,
    isFetching,
    error,
    refetch: () => executeFetch(false),
  };
}

export function useMutation<TData, TVariables>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options: MutationOptions<TData, TVariables> = {}
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const mutateAsync = async (variables: TVariables): Promise<TData> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await mutationFn(variables);
      await options.onSuccess?.(data, variables);
      return data;
    } catch (err: any) {
      const e = err instanceof Error ? err : new Error(String(err));
      setError(e);
      options.onError?.(e, variables);
      throw e;
    } finally {
      setIsLoading(false);
    }
  };

  const mutate = (variables: TVariables) => {
    mutateAsync(variables).catch(() => {});
  };

  return {
    mutate,
    mutateAsync,
    isLoading,
    error,
  };
}
