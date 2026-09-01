import {
  AIChatRequest,
  AIChatResponse,
  AIPdfExtractionResponse,
} from "../types/ai";
import api from "./api";

export const aiService = {
  chat: async (payload: AIChatRequest): Promise<AIChatResponse> => {
    const res = await api.post<AIChatResponse>("/ai/chat", payload);
    return res.data;
  },

  extractPdf: async (file: File): Promise<AIPdfExtractionResponse> => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await api.post<AIPdfExtractionResponse>(
      "/ai/extract-pdf",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    return res.data;
  },
};
