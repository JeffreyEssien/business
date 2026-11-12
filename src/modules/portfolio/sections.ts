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
  publications: {
    name: 'Writing',
    description: 'Articles, essays, papers, or talks, with where they appeared.',
  },
  services: {
    name: 'Services',
    description: 'What people can hire you for, framed around their problem.',
  },
  testimonials: {
    name: 'Testimonials',
    description: 'Kind, specific words from clients, editors, or reviewers.',
  },
  events: {
    name: 'Events',
    description: 'Shows, talks, exhibitions, or news, with dates and ticket links.',
  },
  awards: {
    name: 'Awards',
    description: 'Prizes, recognition, and certificates.',
  },
  clients: {
    name: 'Clients',
    description: 'The names of organisations or events you have worked with.',
  },
  stats: {
    name: 'Key figures',
    description: 'Two or three real numbers that show your track record.',
  },
  process: {
    name: 'How it works',
    description: 'The steps of working with you, numbered.',
  },
  team: {
    name: 'People',
    description: 'Your team or collaborators, with photos.',
  },
  downloads: {
    name: 'Downloads',
    description: 'Buttons that open your CV, press kit, or one-sheet.',
  },
  embed: {
    name: 'Song or video',
    description: 'A player for a song or video from YouTube, Spotify, Audiomack, and more.',
  },
  bios: {
    name: 'Bios',
    description: 'One-line, short, and long versions of your bio, ready to copy.',
  },
  cta: {
    name: 'Call to action',
    description: 'A bold line with one button, e.g. "Start a project".',
  },
  contact: {
    name: 'Contact',
    description: 'How visitors can reach you. Uses the contact details in your settings.',
  },
};
