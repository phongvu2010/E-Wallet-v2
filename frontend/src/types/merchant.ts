export interface MerchantAlias {
  id: string;
  merchant_id: string;
  pattern: string;
  created_at?: string;
}

export interface Merchant {
  id: string;
  cleaned_name: string;
  default_category_id?: string;
  website?: string;
  logo_url?: string;
  created_at?: string;
  aliases?: MerchantAlias[];
}

export interface MerchantSuggestion {
  id: string;
  cleaned_name: string;
  default_category_id?: string;
  default_category_name?: string;
  aliases: string[];
}
