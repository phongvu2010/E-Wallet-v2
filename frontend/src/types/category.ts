export type CategoryType = "EXPENSE" | "INCOME" | "TRANSFER" | "ADJUSTMENT" | "FEE_INTEREST";

export interface Category {
  id: string;
  name: string;
  category_type: CategoryType;
  parent_id?: string;
  icon?: string;
  color?: string;
  is_system?: boolean;
  user_id?: string;
  created_at?: string;
}

export interface CategoryTreeNode extends Category {
  children: Category[];
}

export interface CategoryCreatePayload {
  name: string;
  category_type?: CategoryType;
  parent_id?: string;
  icon?: string;
  color?: string;
  is_system?: boolean;
}

export interface CategoryUpdatePayload {
  name?: string;
  category_type?: CategoryType;
  parent_id?: string | null;
  icon?: string;
  color?: string;
  is_system?: boolean;
}
