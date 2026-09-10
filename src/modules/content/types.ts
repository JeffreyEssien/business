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
export type NavigationEditorItem = SiteNavigationItem & {
  id: string;
  pageId: string | null;
  categoryId: string | null;
};
export type NavigationDestination = { id: string; name: string; slug: string };
export type ContentPage = {
  id: string;
  slug: string;
  name: string;
  page_type: 'ABOUT' | 'CONTACT' | 'POLICY' | 'CUSTOM';
  show_in_navigation: boolean;
  is_enabled: boolean;
  title: string;
  introduction: string;
  body: string;
};
export type PublishedContentPage = Omit<ContentPage, 'show_in_navigation' | 'is_enabled'>;
export type SeoEntityType = 'PAGE' | 'PRODUCT' | 'CATEGORY';
export type PublishedSeoEntry = {
  entityType: SeoEntityType;
  entityId: string;
  title: string;
  description: string;
  canonicalUrl: string | null;
  socialTitle: string;
  socialDescription: string;
  socialImage: string | null;
  allowSearchListing: boolean;
  allowSearchLinks: boolean;
};
export type PublishedSeoSettings = {
  title: string;
  titleTemplate: string;
  description: string;
  twitterHandle: string;
  allowSearchListing: boolean;
  allowSearchLinks: boolean;
  googleVerification: string;
  bingVerification: string;
  customHostname: string | null;
  socialImage: string | null;
};
export type SiteConfiguration = {
  business: {
    name: string;
    description: string;
    phone: string;
    address: string;
    contactEmail?: string;
    whatsapp?: string;
    instagram?: string;
    facebook?: string;
    tiktok?: string;
    city?: string;
    state?: string;
    country?: string;
    logo: SiteMedia;
    heroMedia: SiteMedia;
  };
  theme: {
    presetKey: string;
    tokens: {
      primary: string;
      secondary?: string;
      styleKey?: string;
      accent: string;
      background: string;
      text: string;
    };
  };
  sections: SiteSection[];
  pages: PublishedContentPage[];
  seo?: PublishedSeoSettings;
  seoEntries?: PublishedSeoEntry[];
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
