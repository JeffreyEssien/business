export type CatalogStatus = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string;
  status: CatalogStatus;
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string;
  short_description: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  stock_quantity: number;
  track_inventory: boolean;
  status: CatalogStatus;
  primary_image_asset_id: string | null;
  media_url?: string | null;
  media_alt?: string | null;
  media_type?: 'image' | 'video' | null;
  category_ids: string[];
};

export type PublicProduct = {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  price: number;
  currency: string;
  stockQuantity: number;
  trackInventory: boolean;
  mediaUrl: string | null;
  mediaAlt: string | null;
  mediaType: 'image' | 'video' | null;
  categories: string[];
};

export type PublicCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  productIds: string[];
};

export type PublicStorefront = {
  tenant: { name: string; slug: string };
  site: import('@/modules/content/types').SiteConfiguration | null;
  categories: PublicCategory[];
  products: PublicProduct[];
};
