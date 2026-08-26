import { api } from "./api";
import { Merchant } from "../types/merchant";

export const merchantService = {
  getAll: async (search?: string): Promise<Merchant[]> => {
    const params = search ? { search } : {};
    const res = await api.get<Merchant[]>("/merchants", { params });
    return res.data;
  },
};
