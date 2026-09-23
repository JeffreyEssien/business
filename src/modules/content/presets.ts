export const themePresets = {
  fashion: {
    label: 'Editorial stone',
    tokens: {
      primary: '#342d44',
      secondary: '#74677f',
      accent: '#ad8e64',
      background: '#faf8f5',
      text: '#25222a',
    },
  },
  beauty: {
    label: 'Soft rose',
    tokens: {
      primary: '#9b526d',
      secondary: '#c9829a',
      accent: '#d99bad',
      background: '#fff7fa',
      text: '#392832',
    },
  },
  restaurant: {
    label: 'Warm earth',
    tokens: {
      primary: '#96572f',
      secondary: '#66745a',
      accent: '#d49a52',
      background: '#201d1a',
      text: '#f8f2e9',
    },
  },
  general: {
    label: 'Modern violet',
    tokens: {
      primary: '#6655d7',
      secondary: '#8b7fc7',
      accent: '#e2a94b',
      background: '#f8f8fb',
      text: '#242630',
    },
  },
} as const;

export type ThemePresetKey = keyof typeof themePresets;
export const themePresetOptions = Object.entries(themePresets).map(([value, preset]) => ({
  value,
  label: preset.label,
}));

export const websiteStyleOptions = [
  {
    value: 'clean-minimal',
    label: 'Clean & minimal',
    description: 'Airy sections, restrained details, and a calm product grid.',
    preview: 'clean',
  },
  {
    value: 'elegant-luxury',
    label: 'Elegant & luxury',
    description: 'Editorial typography, generous spacing, and a curated two-column collection.',
    preview: 'elegant',
  },
  {
    value: 'bright-bold',
    label: 'Bright & bold',
    description: 'Graphic borders, confident type, and energetic product tiles.',
    preview: 'bold',
  },
  {
    value: 'soft-friendly',
    label: 'Soft & friendly',
    description: 'Rounded surfaces, welcoming spacing, and gentle product cards.',
    preview: 'soft',
  },
  {
    value: 'warm-natural',
    label: 'Warm & natural',
    description: 'Organic shapes, relaxed type, and an asymmetric collection rhythm.',
    preview: 'warm',
  },
  {
    value: 'professional-modern',
    label: 'Professional & modern',
    description: 'Structured sections, compact geometry, and a denser four-column catalogue.',
    preview: 'professional',
  },
] as const;

export type WebsiteStyleKey = (typeof websiteStyleOptions)[number]['value'];
export function isWebsiteStyleKey(value: string): value is WebsiteStyleKey {
  return websiteStyleOptions.some((option) => option.value === value);
}

export function defaultWebsiteStyle(preset: string): WebsiteStyleKey {
  if (preset === 'fashion') return 'elegant-luxury';
  if (preset === 'beauty') return 'soft-friendly';
  if (preset === 'restaurant') return 'warm-natural';
  return 'clean-minimal';
}
