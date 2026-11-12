/**
 * Portfolio homepage section types. The database (`private.enforce_block_site_kind`)
 * independently rejects these for stores and rejects `products` for portfolios.
 */
export const portfolioSectionLanguage: Record<string, { name: string; description: string }> = {
  hero: {
    name: 'Introduction',
    description: 'Your name, a one-line summary, and the main button visitors see first.',
  },
  about: {
    name: 'About',
    description: 'A short story about who you are and what you do.',
  },
  skills: {
    name: 'Skills',
    description: 'The tools, strengths, and specialisms you want to be known for.',
  },
  projects: {
    name: 'Projects',
    description: 'Your best work, shown as cards, a featured list, or an image wall.',
  },
  experience: {
    name: 'Experience',
    description: 'Roles and clients, shown as a timeline.',
  },
  education: {
    name: 'Education',
    description: 'Degrees, courses, and certifications.',
  },
  contact: {
    name: 'Contact',
    description: 'How visitors can reach you. Uses the contact details in your settings.',
  },
};
