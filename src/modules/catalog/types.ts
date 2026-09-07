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
  image_url?: string | null;
  image_alt?: string | null;
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
  imageUrl: string | null;
  imageAlt: string | null;
  categories: string[];
};

export type PublicStorefront = {
  tenant: { name: string; slug: string };
  products: PublicProduct[];
};
