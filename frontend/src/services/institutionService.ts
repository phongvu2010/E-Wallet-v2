import { api } from "./api";
import { Institution } from "../types/institution";

export const institutionService = {
  getAll: async (): Promise<Institution[]> => {
    const res = await api.get<Institution[]>("/institutions");
    return res.data;
  },
};
