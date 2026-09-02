import { api } from "./api";
import { APIResponse } from "../types/common";

export interface ETLConfig {
  google_sheet_id: string;
  source_type: string;
  has_local_excel: boolean;
  has_cached_sheet: boolean;
}

/**
 * Frontend API client for ETL Synchronization & Google Sheets Data Ingestion.
 */
export const etlService = {
  /**
   * Trigger backend ETL script execution to ingest data from Google Sheets / Excel.
   */
  sync: async (
    googleSheetId?: string,
    sourceType: string = "google_sheet"
  ): Promise<APIResponse<{ output: string }>> => {
    const res = await api.post<APIResponse<{ output: string }>>("/etl/sync", {
      google_sheet_id: googleSheetId || undefined,
      source_type: sourceType,
    });
    return res.data;
  },

  /**
   * Fetch current ETL Google Sheets configuration.
   */
  getConfig: async (): Promise<APIResponse<ETLConfig>> => {
    const res = await api.get<APIResponse<ETLConfig>>("/etl/config");
    return res.data;
  },

  /**
   * Update active Google Sheet ID configuration.
   */
  updateConfig: async (
    googleSheetId: string
  ): Promise<APIResponse<ETLConfig>> => {
    const res = await api.post<APIResponse<ETLConfig>>("/etl/config", {
      google_sheet_id: googleSheetId,
    });
    return res.data;
  },
};

