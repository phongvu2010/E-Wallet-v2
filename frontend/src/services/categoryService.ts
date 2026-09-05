import { api } from "./api";
import {
  Category,
  CategoryCreatePayload,
  CategoryTreeNode,
  CategoryUpdatePayload,
} from "../types/category";

/**
 * Frontend API client for Category Taxonomy.
 */
export const categoryService = {
  /**
   * Fetch flat list of categories, optionally filtered by type (EXPENSE/INCOME/TRANSFER).
   */
  getAll: async (categoryType?: string): Promise<Category[]> => {
    const params = categoryType ? { category_type: categoryType } : {};
    const res = await api.get<Category[]>("/categories", { params });
    return res.data;
  },

  /**
   * Fetch hierarchical 2-tier parent-child category tree.
   */
  getTree: async (): Promise<CategoryTreeNode[]> => {
    const res = await api.get<CategoryTreeNode[]>("/categories/tree");
    return res.data;
  },

  /**
   * Create a new category or subcategory.
   */
  create: async (payload: CategoryCreatePayload): Promise<Category> => {
    const res = await api.post<Category>("/categories", payload);
    return res.data;
  },

  /**
   * Update category properties.
   */
  update: async (
    id: string,
    payload: CategoryUpdatePayload
  ): Promise<Category> => {
    const res = await api.put<Category>(`/categories/${id}`, payload);
    return res.data;
  },

  /**
   * Delete a category.
   */
  delete: async (id: string): Promise<void> => {
    await api.delete(`/categories/${id}`);
  },
};
