export const themePresets = {
  fashion: {
    label: 'Fashion minimal',
    tokens: { primary: '#342d44', accent: '#ad8e64', background: '#faf8f5', text: '#25222a' },
  },
  beauty: {
    label: 'Beauty soft',
    tokens: { primary: '#9b526d', accent: '#d99bad', background: '#fff7fa', text: '#392832' },
  },
  restaurant: {
    label: 'Restaurant warm',
    tokens: { primary: '#96572f', accent: '#d49a52', background: '#201d1a', text: '#f8f2e9' },
  },
  general: {
    label: 'General modern',
    tokens: { primary: '#6655d7', accent: '#e2a94b', background: '#f8f8fb', text: '#242630' },
  },
} as const;

export type ThemePresetKey = keyof typeof themePresets;
export const themePresetOptions = Object.entries(themePresets).map(([value, preset]) => ({
  value,
  label: preset.label,
}));
