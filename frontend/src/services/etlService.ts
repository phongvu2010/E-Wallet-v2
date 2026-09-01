import { api } from "./api";
import { APIResponse } from "../types/common";

/**
 * Frontend API client for ETL Synchronization.
 */
export const etlService = {
  /**
   * Trigger backend ETL script execution to ingest latest Excel statements.
   */
  sync: async (): Promise<APIResponse<{ output: string }>> => {
    const res = await api.post<APIResponse<{ output: string }>>("/etl/sync");
    return res.data;
  },
};
