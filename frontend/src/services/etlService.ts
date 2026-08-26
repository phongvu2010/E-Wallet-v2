import { api } from "./api";
import { APIResponse } from "../types/common";

export const etlService = {
  sync: async (): Promise<APIResponse<{ output: string }>> => {
    const res = await api.post<APIResponse<{ output: string }>>("/etl/sync");
    return res.data;
  },
};
