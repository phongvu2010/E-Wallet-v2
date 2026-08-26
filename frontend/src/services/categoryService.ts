import { api } from "./api";
import { Category, CategoryTreeNode } from "../types/category";

export const categoryService = {
  getAll: async (categoryType?: string): Promise<Category[]> => {
    const params = categoryType ? { category_type: categoryType } : {};
    const res = await api.get<Category[]>("/categories", { params });
    return res.data;
  },

  getTree: async (): Promise<CategoryTreeNode[]> => {
    const res = await api.get<CategoryTreeNode[]>("/categories/tree");
    return res.data;
  },
};
