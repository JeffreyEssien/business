import type { PublicProduct } from '@/modules/catalog/types';

export type SiteMedia = { url: string; alt: string | null } | null;
export type SiteSection = {
  key: string;
  type: string;
  variant: string;
  enabled: boolean;
  content: Record<string, unknown>;
  settings: Record<string, unknown>;
};
export type SiteNavigationItem = {
  label: string;
  target: string;
  location: 'HEADER' | 'FOOTER';
  linkType: 'PAGE' | 'URL' | 'CATEGORY';
  enabled: boolean;
};
export type SiteConfiguration = {
  business: {
    name: string;
    description: string;
    phone: string;
    address: string;
    logo: SiteMedia;
    heroMedia: SiteMedia;
  };
  theme: {
    presetKey: string;
    tokens: { primary: string; accent: string; background: string; text: string };
  };
  sections: SiteSection[];
  navigation: SiteNavigationItem[];
};
export type StorefrontView = {
  tenant: { name: string; slug: string };
  site: SiteConfiguration | null;
  products: PublicProduct[];
};

export type SiteEditorData = {
  configuration: SiteConfiguration;
  products: PublicProduct[];
  publishedVersion: number | null;
  mediaRecords: Array<{
    id: string;
    storage_provider: string;
    storage_key: string;
    resource_type: 'image' | 'video';
  }>;
};
