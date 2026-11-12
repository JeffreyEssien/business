/**
 * The portfolio template library (docs/plans/portfolio-templates.md §4): 24 templates,
 * two per audience, each with its own look, page parts, and example content.
 *
 * This file is the single source of truth. `scripts/generate-portfolio-templates.mjs`
 * writes it into a migration (the database seeds new portfolios from `site_templates`),
 * and tests/unit/portfolio-templates.test.mjs fails if the two ever differ. The public
 * template gallery renders previews straight from here, so it needs no database.
 *
 * Example ("sample") fields are listed per part and per entry using database column
 * names. Visible example values block "Make it live" until the owner replaces them.
 * Headings and button labels are sensible defaults, not examples.
 */
import type { Palette } from './looks';

export type TemplateSection = {
  key: string;
  type: string;
  variant: string;
  content: Record<string, unknown>;
  sampleFields: string[];
};

export type TemplateItem = {
  type: string;
  title: string;
  subtitle?: string;
  summary?: string;
  role?: string;
  outcome?: string;
  linkUrl?: string;
  sourceUrl?: string;
  startsOn?: string;
  endsOn?: string;
  isCurrent?: boolean;
  tags?: string[];
  sampleFields: string[];
};

export type LibraryTemplate = {
  key: string;
  name: string;
  description: string;
  audience: string;
  /** Plain words for "What do you do?" in the guided start and gallery filters. */
  audienceGroup: string;
  defaultPreset: 'general' | 'fashion' | 'beauty' | 'restaurant';
  sortOrder: number;
  tokens: Palette & { styleKey: string; templateStyle: string };
  /** Extra ready-made colour sets offered in "Change colours" (the first is `tokens`). */
  palettes: Array<{ name: string; colors: Palette }>;
  /** Shown only in gallery previews; provisioning uses the owner's own name. */
  preview: { name: string };
  sections: TemplateSection[];
  items: TemplateItem[];
};

const hero = (
  variant: string,
  eyebrow: string,
  subheadline: string,
  label: string,
  href = '#contact',
): TemplateSection => ({
  key: 'hero',
  type: 'hero',
  variant,
  content: { eyebrow, subheadline, primaryCta: { label, href } },
  sampleFields: ['eyebrow', 'subheadline'],
});

const textPart = (
  type: 'about' | 'contact',
  variant: string,
  heading: string,
  body: string,
  key: string = type,
): TemplateSection => ({ key, type, variant, content: { heading, body }, sampleFields: ['body'] });

const listPart = (type: string, variant: string, heading: string, key = type): TemplateSection => ({
  key,
  type,
  variant,
  content: { heading },
  sampleFields: [],
});

const palette = (
  name: string,
  background: string,
  text: string,
  primary: string,
  accent: string,
  secondary: string,
) => ({ name, colors: { background, text, primary, accent, secondary } });

const testimonial = (summary: string, title: string, subtitle: string): TemplateItem => ({
  type: 'TESTIMONIAL',
  title,
  subtitle,
  summary,
  sampleFields: ['title', 'subtitle', 'summary'],
});

const service = (title: string, summary: string, subtitle = ''): TemplateItem => ({
  type: 'SERVICE',
  title,
  subtitle,
  summary,
  sampleFields: subtitle ? ['subtitle', 'summary'] : ['summary'],
});

const step = (title: string, summary: string): TemplateItem => ({
  type: 'STEP',
  title,
  summary,
  sampleFields: ['summary'],
});

const stat = (title: string, summary: string): TemplateItem => ({
  type: 'STAT',
  title,
  summary,
  sampleFields: ['title', 'summary'],
});

const client = (title: string): TemplateItem => ({
  type: 'CLIENT',
  title,
  sampleFields: ['title'],
});

export const portfolioTemplateLibrary: LibraryTemplate[] = [
  // Developers & engineers ----------------------------------------------------------
  {
    key: 'developer',
    name: 'Terminal',
    description:
      'A dark, code-like portfolio that scans in seconds for stack, projects, and links.',
    audience: 'Developers & engineers',
    audienceGroup: 'software',
    defaultPreset: 'general',
    sortOrder: 10,
    tokens: {
      background: '#0d1117',
      text: '#e6edf3',
      primary: '#3ddc97',
      accent: '#58c4dc',
      secondary: '#8b949e',
      styleKey: 'professional-modern',
      templateStyle: 'pf-terminal',
    },
    palettes: [],
    preview: { name: 'Chidi Okeke' },
    sections: [
      hero(
        'centered',
        'Software engineer',
        'I design, build, and ship reliable software. Replace this line with a one-sentence summary of what you do best.',
        'Get in touch',
      ),
      textPart(
        'about',
        'text',
        'About me',
        'Introduce yourself here: what you work on, the problems you enjoy solving, and what you are looking for next.',
      ),
      listPart('skills', 'tags', 'Skills & tools'),
      listPart('projects', 'list', 'Selected projects'),
      listPart('experience', 'timeline', 'Experience'),
      textPart(
        'contact',
        'details',
        "Let's work together",
        'Tell visitors how to reach you and what kinds of work or roles you are open to.',
      ),
    ],
    items: [
      {
        type: 'PROJECT',
        title: 'Payments reconciliation API',
        subtitle: 'Backend service',
        summary: 'Matches bank transfers to invoices automatically for a growing online store.',
        role: 'Lead developer: designed the API and data model.',
        outcome: 'Daily reconciliation went from hours of manual checks to minutes.',
        tags: ['Node.js', 'PostgreSQL', 'Docker'],
        linkUrl: 'https://example.com/project',
        sourceUrl: 'https://github.com/your-name/project',
        sampleFields: ['title', 'summary', 'role', 'outcome', 'link_url', 'source_url'],
      },
      {
        type: 'PROJECT',
        title: 'Community events app',
        subtitle: 'Web app',
        summary: 'Lets neighbourhood groups publish events and take RSVPs from their phones.',
        role: 'Full-stack developer, from design to launch.',
        outcome: 'Used by 40 groups in its first three months.',
        tags: ['React', 'Next.js', 'Supabase'],
        linkUrl: 'https://example.com/app',
        sampleFields: ['title', 'summary', 'role', 'outcome', 'link_url'],
      },
      {
        type: 'PROJECT',
        title: 'Open-source form library',
        subtitle: 'Open source',
        summary: 'A small library for accessible, validated forms.',
        role: 'Creator and maintainer.',
        outcome: '',
        tags: ['TypeScript', 'Accessibility'],
        sourceUrl: 'https://github.com/your-name/forms',
        sampleFields: ['title', 'summary', 'role', 'source_url'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Software Engineer',
        subtitle: 'Example Company, Lagos',
        summary:
          'Built and maintained customer-facing features; led the move to automated testing.',
        startsOn: '2023-01-01',
        isCurrent: true,
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Junior Developer',
        subtitle: 'Sample Studio, Remote',
        summary: 'Shipped websites for small businesses and set up their hosting.',
        startsOn: '2021-06-01',
        endsOn: '2022-12-01',
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'SKILL',
        title: 'Languages',
        tags: ['TypeScript', 'Python', 'SQL'],
        sampleFields: ['tags'],
      },
      {
        type: 'SKILL',
        title: 'Frameworks',
        tags: ['React', 'Next.js', 'Express'],
        sampleFields: ['tags'],
      },
      { type: 'SKILL', title: 'Tools', tags: ['Git', 'Docker', 'AWS'], sampleFields: ['tags'] },
    ],
  },
  {
    key: 'developer-product',
    name: 'Product engineer',
    description: 'Light and warm. Frames engineering work as product impact for senior roles.',
    audience: 'Developers & engineers',
    audienceGroup: 'software',
    defaultPreset: 'general',
    sortOrder: 11,
    tokens: {
      background: '#fbfaf7',
      text: '#1c1b22',
      primary: '#4f46e5',
      accent: '#f59e0b',
      secondary: '#64627a',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-product',
    },
    palettes: [
      palette('Night shift', '#14141b', '#ececf3', '#a5a1ff', '#fbbf24', '#9a98b0'),
      palette('Mint', '#f6fbf8', '#15241d', '#0f766e', '#f97316', '#55665e'),
    ],
    preview: { name: 'Bisola Adeyemi' },
    sections: [
      hero(
        'split',
        'Product engineer',
        'I build products people actually use, from the first sketch to the metrics after launch. Replace this with your own summary.',
        'Get in touch',
      ),
      listPart('projects', 'case-study', 'Impact'),
      listPart('experience', 'compact', 'Experience'),
      listPart('skills', 'grouped', 'What I work with'),
      listPart('publications', 'list', 'Writing & talks'),
      textPart(
        'contact',
        'details',
        'Say hello',
        'Tell people which roles or projects you are open to, and how soon you can start.',
      ),
    ],
    items: [
      {
        type: 'PROJECT',
        title: 'Checkout that works on slow networks',
        subtitle: 'E-commerce · 2025',
        summary:
          'Shoppers on 3G abandoned payment pages that took 12 seconds to load. I rebuilt checkout to load in under two.',
        role: 'Tech lead: profiling, architecture, and the rollout plan.',
        outcome: 'Completed payments rose 18% in the first month.',
        tags: ['Performance', 'Next.js', 'Payments'],
        linkUrl: 'https://example.com/checkout',
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome', 'link_url'],
      },
      {
        type: 'PROJECT',
        title: 'Self-serve onboarding for merchants',
        subtitle: 'B2B SaaS · 2024',
        summary:
          'Every new merchant needed a support call to get started. I designed and built a guided setup with the support team.',
        role: 'Full-stack engineer and product partner.',
        outcome: 'Support calls for new accounts fell by half.',
        tags: ['React', 'Node.js', 'Product'],
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Senior Software Engineer',
        subtitle: 'Example Fintech, Lagos',
        startsOn: '2023-04-01',
        isCurrent: true,
        sampleFields: ['subtitle'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Software Engineer',
        subtitle: 'Sample Commerce, Remote',
        startsOn: '2020-08-01',
        endsOn: '2023-03-01',
        sampleFields: ['subtitle'],
      },
      {
        type: 'SKILL',
        title: 'Building',
        tags: ['TypeScript', 'React', 'Node.js', 'PostgreSQL'],
        sampleFields: ['tags'],
      },
      {
        type: 'SKILL',
        title: 'Product',
        tags: ['Experiment design', 'Analytics', 'Writing specs'],
        sampleFields: ['tags'],
      },
      {
        type: 'PUBLICATION',
        title: 'Shipping fast pages for slow networks',
        subtitle: 'Talk · Example Dev Conference',
        summary: 'What we learned making checkout load in two seconds on 3G.',
        linkUrl: 'https://example.com/talk',
        startsOn: '2025-09-01',
        sampleFields: ['title', 'subtitle', 'summary', 'link_url'],
      },
    ],
  },

  // Designers -------------------------------------------------------------------------
  {
    key: 'designer',
    name: 'Case study',
    description: 'An airy, text-led portfolio built around problem, approach, and result.',
    audience: 'Product & UI designers',
    audienceGroup: 'design',
    defaultPreset: 'general',
    sortOrder: 12,
    tokens: {
      background: '#fafaf7',
      text: '#1d1d1f',
      primary: '#1d1d1f',
      accent: '#e5482a',
      secondary: '#6e6e73',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-case-study',
    },
    palettes: [],
    preview: { name: 'Zainab Bello' },
    sections: [
      hero(
        'centered',
        'Product designer',
        'I turn complex problems into clear, friendly products. Replace this with your own introduction.',
        'Work with me',
      ),
      listPart('projects', 'featured', 'Case studies'),
      textPart(
        'about',
        'text',
        'How I work',
        'Describe your design process, the teams you have worked with, and the kind of products you love to make.',
      ),
      listPart('skills', 'tags', 'What I do'),
      listPart('testimonials', 'quotes', 'Kind words'),
      textPart(
        'contact',
        'details',
        'Start a project',
        'Share how clients or hiring teams can reach you.',
      ),
    ],
    items: [
      {
        type: 'PROJECT',
        title: 'Simplifying a savings app sign-up',
        subtitle: 'Case study · Fintech',
        summary:
          'New users dropped off during a long identity check. I redesigned the flow around what people had to hand.',
        role: 'Lead product designer: research, flows, and final UI.',
        outcome: 'Sign-up completion rose from 41% to 63%.',
        tags: ['Research', 'Mobile', 'Onboarding'],
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome'],
      },
      {
        type: 'PROJECT',
        title: 'A design system for a logistics team',
        subtitle: 'Case study · B2B',
        summary:
          'Five products looked and behaved differently. I built a shared component library with the engineers.',
        role: 'Design system lead.',
        outcome: 'New screens now ship in days instead of weeks.',
        tags: ['Design systems', 'Figma'],
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome'],
      },
      {
        type: 'PROJECT',
        title: 'Booking for a neighbourhood clinic',
        subtitle: 'Case study · Health',
        summary:
          'Patients queued for hours. I designed a simple booking tool that works on any phone.',
        role: 'Product designer, working with a solo developer.',
        outcome: '',
        tags: ['Service design', 'Accessibility'],
        sampleFields: ['title', 'subtitle', 'summary', 'role'],
      },
      {
        type: 'SKILL',
        title: 'What I do',
        tags: ['Product design', 'UX research', 'Prototyping', 'Design systems'],
        sampleFields: ['tags'],
      },
      testimonial(
        'She asked the questions nobody else did, and the product is simpler because of it.',
        'Sample name',
        'Head of Product, Example Fintech',
      ),
      testimonial(
        'Clear thinking, calm under deadlines, and designs our engineers loved building.',
        'Sample name',
        'CTO, Sample Logistics',
      ),
    ],
  },
  {
    key: 'designer-bold',
    name: 'Bold canvas',
    description: 'Brutalist black, white, and electric yellow, with big type and mixed-size tiles.',
    audience: 'Brand & visual designers',
    audienceGroup: 'design',
    defaultPreset: 'general',
    sortOrder: 13,
    tokens: {
      background: '#ffffff',
      text: '#0a0a0a',
      primary: '#0a0a0a',
      accent: '#ffe600',
      secondary: '#3d3d3d',
      styleKey: 'bright-bold',
      templateStyle: 'pf-bold',
    },
    palettes: [
      palette('Inverted', '#0a0a0a', '#f5f5f5', '#ffe600', '#ffe600', '#bdbdbd'),
      palette('Signal red', '#fff8f0', '#160d0a', '#d7261e', '#160d0a', '#4a3a33'),
    ],
    preview: { name: 'Tolu Martins' },
    sections: [
      hero(
        'centered',
        'Brand & motion designer',
        'Identities, campaigns, and motion for brands that refuse to blend in. Replace this with your own line.',
        'Start a project',
      ),
      listPart('projects', 'modular', 'Selected work'),
      listPart('stats', 'figures', 'In numbers'),
      textPart(
        'about',
        'text',
        'About',
        'Say who you are, where you work from, and the kind of briefs that make you say yes.',
      ),
      listPart('testimonials', 'spotlight', 'Said about me'),
      {
        key: 'cta',
        type: 'cta',
        variant: 'banner',
        content: {
          heading: 'Got a brand that needs a voice?',
          body: 'Tell me about it. I reply to every message within two working days.',
          primaryCta: { label: 'Email me', href: '#contact' },
        },
        sampleFields: ['body'],
      },
      textPart('contact', 'details', 'Contact', 'Share the best way to reach you for new briefs.'),
    ],
    items: [
      ...[
        ['Lagos Fashion Week identity', 'Identity · 2025'],
        ['Kola drinks relaunch', 'Packaging · 2025'],
        ['Afrobeats festival motion pack', 'Motion · 2024'],
        ['Neighbourhood bank rebrand', 'Identity · 2024'],
        ['Streetwear lookbook', 'Art direction · 2023'],
        ['Podcast cover series', 'Illustration · 2023'],
      ].map(([title, subtitle]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        role: 'Design lead',
        sampleFields: ['title', 'subtitle'],
      })),
      stat('40+', 'brands launched'),
      stat('9', 'years in practice'),
      stat('3', 'design awards'),
      testimonial(
        'Bold without being loud. Our sales doubled after the relaunch.',
        'Sample name',
        'Founder, Example Drinks',
      ),
    ],
  },

  // Photographers ---------------------------------------------------------------------
  {
    key: 'photographer',
    name: 'Darkroom',
    description: 'An image-first, gallery-dark portfolio for portrait, event, and fine-art work.',
    audience: 'Photographers',
    audienceGroup: 'visual',
    defaultPreset: 'fashion',
    sortOrder: 14,
    tokens: {
      background: '#121110',
      text: '#f2ede4',
      primary: '#c9a46a',
      accent: '#c9a46a',
      secondary: '#8f8577',
      styleKey: 'elegant-luxury',
      templateStyle: 'pf-darkroom',
    },
    palettes: [],
    preview: { name: 'Emeka Nwosu' },
    sections: [
      hero(
        'image-overlay',
        'Photography',
        'Portraits, events, and stories told in light. Replace this with a line about your style.',
        'Book a session',
      ),
      listPart('projects', 'masonry', 'Portfolio'),
      textPart(
        'about',
        'text',
        'Behind the lens',
        'Tell visitors who you are, where you shoot, and what it is like to work with you.',
      ),
      textPart(
        'contact',
        'details',
        'Bookings',
        'Explain how to book you and which locations you cover.',
      ),
    ],
    items: [
      {
        type: 'PROJECT',
        title: 'Portraits in Lagos',
        subtitle: 'Series · 2025',
        summary: 'Natural-light portraits of artists and makers in their studios.',
        tags: ['Portrait'],
        sampleFields: ['title', 'subtitle', 'summary'],
      },
      {
        type: 'PROJECT',
        title: 'Weddings',
        subtitle: 'Series · Ongoing',
        summary: 'Documentary-style coverage, from getting ready to the last dance.',
        tags: ['Events'],
        sampleFields: ['title', 'summary'],
      },
    ],
  },
  {
    key: 'photographer-gallery',
    name: 'White wall',
    description: 'Pure white and quiet, so commercial and product photographs fill the page.',
    audience: 'Commercial photographers',
    audienceGroup: 'visual',
    defaultPreset: 'general',
    sortOrder: 15,
    tokens: {
      background: '#ffffff',
      text: '#111111',
      primary: '#111111',
      accent: '#111111',
      secondary: '#6b6b6b',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-white-wall',
    },
    palettes: [
      palette('Bone', '#f5f2ec', '#1b1a17', '#1b1a17', '#8a6d3b', '#6c675e'),
      palette('Graphite', '#18181a', '#ededed', '#ededed', '#9a9a9a', '#9a9a9a'),
    ],
    preview: { name: 'Kemi Alabi' },
    sections: [
      hero(
        'centered',
        'Commercial & product photography',
        'Products, food, and interiors photographed for brands in Lagos and Abuja. Replace this with your own line.',
        'Enquire',
      ),
      listPart('projects', 'masonry', 'Work'),
      listPart('clients', 'strip', 'Selected clients'),
      textPart(
        'about',
        'text',
        'About',
        'Two or three sentences about your studio, your kit, and how you work with brands.',
      ),
      textPart(
        'contact',
        'details',
        'Enquiries',
        'Share your email and how far ahead clients should book.',
      ),
    ],
    items: [
      {
        type: 'PROJECT',
        title: 'Spring menu',
        subtitle: 'Food · Example Restaurant',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'PROJECT',
        title: 'Skincare launch',
        subtitle: 'Product · Sample Beauty',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'PROJECT',
        title: 'Lekki apartment',
        subtitle: 'Interiors · Example Homes',
        sampleFields: ['title', 'subtitle'],
      },
      client('Sample client'),
      client('Example Foods'),
      client('Sample Beauty'),
      client('Example Homes'),
    ],
  },

  // Writers ---------------------------------------------------------------------------
  {
    key: 'writer',
    name: 'Editorial',
    description:
      'Newspaper-like: a masthead, clips grouped by topic, and thin rules between stories.',
    audience: 'Writers & journalists',
    audienceGroup: 'writing',
    defaultPreset: 'general',
    sortOrder: 16,
    tokens: {
      background: '#f7f3ea',
      text: '#1a1a1a',
      primary: '#b3261e',
      accent: '#b3261e',
      secondary: '#5c5649',
      styleKey: 'elegant-luxury',
      templateStyle: 'pf-editorial',
    },
    palettes: [
      palette('Broadsheet', '#ffffff', '#111111', '#111111', '#0b57d0', '#555555'),
      palette('Evening edition', '#1b1a17', '#efe9dc', '#ff8a7a', '#ff8a7a', '#b3aa98'),
    ],
    preview: { name: 'Ngozi Eze' },
    sections: [
      hero(
        'centered',
        'Journalist · Business & technology',
        'I report on the people and money behind Africa’s tech boom. Replace this with your beat and outlets.',
        'Commission me',
      ),
      listPart('publications', 'editorial', 'Selected clips'),
      textPart(
        'about',
        'text',
        'About',
        'Your background, beats, languages, and the outlets you have written for.',
      ),
      listPart('testimonials', 'quotes', 'From editors'),
      textPart(
        'contact',
        'details',
        'Pitches & commissions',
        'Tell editors how to reach you and how quickly you can file.',
      ),
    ],
    items: [
      ...[
        [
          'Inside the race to digitise market traders',
          'Example Business Daily',
          'Technology',
          '2025-10-01',
        ],
        ['Why fintechs are moving to the north', 'Sample Tech Review', 'Technology', '2025-07-01'],
        ['The founders building for farmers', 'Example Weekly', 'Technology', '2025-03-01'],
        [
          'What the new tax rules mean for freelancers',
          'Example Business Daily',
          'Money',
          '2025-09-01',
        ],
        ['A year of the cashless experiment', 'Sample Magazine', 'Money', '2025-05-01'],
        ['Saving in dollars: a beginner’s guide', 'Example Weekly', 'Money', '2024-12-01'],
      ].map(([title, subtitle, topic, startsOn]): TemplateItem => ({
        type: 'PUBLICATION',
        title,
        subtitle,
        tags: [topic],
        linkUrl: 'https://example.com/article',
        startsOn,
        sampleFields: ['title', 'subtitle', 'link_url'],
      })),
      testimonial(
        'Files clean, on time, and always finds the human angle.',
        'Sample name',
        'Features Editor, Example Business Daily',
      ),
      testimonial(
        'One of the sharpest tech reporters we work with.',
        'Sample name',
        'Editor, Sample Tech Review',
      ),
    ],
  },
  {
    key: 'writer-notebook',
    name: 'Notebook',
    description:
      'Text-only and calm, for essayists, poets, and bloggers who value reading comfort.',
    audience: 'Essayists & bloggers',
    audienceGroup: 'writing',
    defaultPreset: 'general',
    sortOrder: 17,
    tokens: {
      background: '#f4efe6',
      text: '#2b2620',
      primary: '#7a4b2a',
      accent: '#c0612b',
      secondary: '#6d6357',
      styleKey: 'warm-natural',
      templateStyle: 'pf-notebook',
    },
    palettes: [
      palette('Ink', '#ffffff', '#1f2430', '#2d4a8a', '#2d4a8a', '#5d6475'),
      palette('Lamp light', '#201c17', '#efe6d6', '#e8a46a', '#e8a46a', '#b0a491'),
    ],
    preview: { name: 'Ifeoma Uche' },
    sections: [
      hero(
        'centered',
        'Essays & notes',
        'I write about cities, family, and the small rituals that hold a life together. Replace this with a sentence in your own voice.',
        'Read my essays',
        '#publications',
      ),
      listPart('publications', 'index', 'Selected essays'),
      {
        key: 'cta',
        type: 'cta',
        variant: 'centered',
        content: {
          heading: 'A letter, once a month',
          body: 'New essays and the books I am reading, straight to your inbox.',
          primaryCta: { label: 'Subscribe', href: 'https://example.com/newsletter' },
        },
        sampleFields: ['body', 'primaryCta'],
      },
      textPart(
        'about',
        'text',
        'About me',
        'A short paragraph about who you are and why you write.',
      ),
      textPart('contact', 'details', 'Write to me', 'Tell readers and editors how to reach you.'),
    ],
    items: [
      ['On leaving Ibadan', 'Example Review', '2025-08-01'],
      ['My grandmother’s radio', 'Sample Quarterly', '2025-04-01'],
      ['Traffic as a love language', 'My newsletter', '2024-11-01'],
      ['The year I learned to swim', 'Example Review', '2024-06-01'],
      ['Notes on silence', 'My newsletter', '2023-12-01'],
    ].map(([title, subtitle, startsOn]): TemplateItem => ({
      type: 'PUBLICATION',
      title,
      subtitle,
      summary: 'Replace this with a one-line summary of the essay.',
      linkUrl: 'https://example.com/essay',
      startsOn,
      sampleFields: ['title', 'subtitle', 'summary', 'link_url'],
    })),
  },

  // Freelancers & consultants -----------------------------------------------------------
  {
    key: 'freelancer',
    name: 'Studio of one',
    description: 'Clean and confident. Services come first and every section leads to an enquiry.',
    audience: 'Freelancers & consultants',
    audienceGroup: 'freelance',
    defaultPreset: 'general',
    sortOrder: 18,
    tokens: {
      background: '#fbf8f3',
      text: '#13302d',
      primary: '#0f5e57',
      accent: '#e0b07a',
      secondary: '#566966',
      styleKey: 'soft-friendly',
      templateStyle: 'pf-studio-one',
    },
    palettes: [
      palette('Plum', '#fbf7fb', '#2a1630', '#7b2d8b', '#f2a65a', '#6d5872'),
      palette('Ocean night', '#0f1d24', '#e7f0f2', '#6fd3c5', '#f2c38b', '#9bb1b6'),
    ],
    preview: { name: 'Funmi Ajayi' },
    sections: [
      hero(
        'split',
        'Freelance brand strategist',
        'I help small food and beauty brands find a clear voice and a look customers remember. Replace this with who you help and how.',
        'Start a project',
      ),
      listPart('services', 'cards', 'How I can help'),
      listPart('process', 'numbered', 'How we work together'),
      listPart('projects', 'case-study', 'Recent work'),
      listPart('testimonials', 'quotes', 'What clients say'),
      {
        key: 'cta',
        type: 'cta',
        variant: 'banner',
        content: {
          heading: 'Ready when you are',
          body: 'Tell me about your brand and I will reply within two working days.',
          primaryCta: { label: 'Start a project', href: '#contact' },
        },
        sampleFields: ['body'],
      },
      textPart(
        'contact',
        'details',
        'Get in touch',
        'Share your email, and say what a good first message includes.',
      ),
    ],
    items: [
      service(
        'Brand foundations',
        'A clear promise, tone of voice, and message house your whole team can use.',
        'From ₦450,000',
      ),
      service(
        'Launch campaigns',
        'A focused 6-week plan to launch a product, with content ready to post.',
        'From ₦300,000',
      ),
      service(
        'Strategy sessions',
        'Two hours to untangle one hard question, with notes you keep.',
        '₦80,000 per session',
      ),
      step(
        'A free first call',
        'Thirty minutes to understand your business and whether I can help.',
      ),
      step('A clear proposal', 'What I will do, by when, and the fixed price. No surprises.'),
      step(
        'Work in the open',
        'Weekly check-ins and a shared folder, so you always know where we are.',
      ),
      step('Hand-over', 'Everything you need to keep going without me.'),
      {
        type: 'PROJECT',
        title: 'Repositioning a family bakery',
        subtitle: 'Brand strategy · 2025',
        summary: 'A 30-year-old bakery was losing young customers to new chains.',
        role: 'Strategy, naming, and launch plan.',
        outcome: 'Weekend sales up a quarter within three months.',
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome'],
      },
      {
        type: 'PROJECT',
        title: 'Launching a natural skincare line',
        subtitle: 'Launch campaign · 2024',
        summary: 'A new founder needed a launch that felt premium on a small budget.',
        role: 'Campaign strategy and content plan.',
        outcome: '',
        sampleFields: ['title', 'subtitle', 'summary', 'role'],
      },
      testimonial(
        'Funmi found words for what we had been trying to say for years.',
        'Sample name',
        'Owner, Example Bakery',
      ),
      testimonial(
        'Organised, honest about timelines, and worth every naira.',
        'Sample name',
        'Founder, Sample Skincare',
      ),
    ],
  },
  {
    key: 'freelancer-results',
    name: 'Results',
    description: 'Dark navy and lime with big numbers, for marketers and consultants who measure.',
    audience: 'Marketers & growth consultants',
    audienceGroup: 'freelance',
    defaultPreset: 'general',
    sortOrder: 19,
    tokens: {
      background: '#0b1324',
      text: '#e8edf7',
      primary: '#c6f432',
      accent: '#c6f432',
      secondary: '#93a0b8',
      styleKey: 'professional-modern',
      templateStyle: 'pf-results',
    },
    palettes: [
      palette('Daylight', '#f7f9fc', '#0b1324', '#1d4ed8', '#65a30d', '#4b5870'),
      palette('Ember', '#170d0b', '#f6ebe7', '#ff7a45', '#ff7a45', '#b59d94'),
    ],
    preview: { name: 'Seun Coker' },
    sections: [
      hero(
        'centered',
        'Growth marketing consultant',
        'I help consumer brands grow with paid social, email, and better landing pages. Replace this with your own line.',
        'Book a call',
      ),
      listPart('stats', 'band', 'Track record'),
      listPart('clients', 'strip', 'Clients I’ve worked with'),
      listPart('projects', 'case-study', 'Case studies'),
      listPart('services', 'list', 'Services'),
      listPart('testimonials', 'spotlight', 'Client feedback'),
      textPart(
        'contact',
        'details',
        'Let’s talk numbers',
        'Say how to reach you and what to include: budget, goal, and timeline.',
      ),
    ],
    items: [
      stat('3.4×', 'average return on ad spend'),
      stat('₦1.2bn', 'in tracked client revenue'),
      stat('60+', 'campaigns run'),
      ...[
        'Sample client',
        'Example Foods',
        'Sample Fashion',
        'Example Pay',
        'Sample Travel',
        'Example Health',
      ].map(client),
      {
        type: 'PROJECT',
        title: 'Lowering the cost of a new customer',
        subtitle: 'Paid social · Fashion',
        summary:
          'Ads were profitable on the first order only. We rebuilt targeting around repeat buyers.',
        role: 'Strategy and campaign management.',
        outcome: 'Cost per customer fell 38% in eight weeks.',
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome'],
      },
      {
        type: 'PROJECT',
        title: 'Emails people open',
        subtitle: 'Email · Food delivery',
        summary:
          'A list of 80,000 people was ignoring newsletters. We moved to short, useful weekly notes.',
        role: 'Email strategy and copy.',
        outcome: 'Open rate up from 9% to 31%.',
        sampleFields: ['title', 'subtitle', 'summary', 'role', 'outcome'],
      },
      service(
        'Paid social audits',
        'A clear report on where your ad money goes and what to change.',
      ),
      service('Growth retainers', 'Monthly planning, testing, and reporting with your team.'),
      service('Landing page reviews', 'Practical fixes to turn more visitors into buyers.'),
      testimonial(
        'We finally know which naira is working. Seun paid for himself in a month.',
        'Sample name',
        'CEO, Example Foods',
      ),
      testimonial(
        'Straight talking and data-led.',
        'Sample name',
        'Marketing Lead, Sample Fashion',
      ),
    ],
  },

  // Creative studios ---------------------------------------------------------------------
  {
    key: 'creative-studio',
    name: 'Agency',
    description: 'Black, bold, and full-bleed. Shows a studio’s range, team, and clients.',
    audience: 'Creative studios & agencies',
    audienceGroup: 'studio',
    defaultPreset: 'general',
    sortOrder: 20,
    tokens: {
      background: '#0a0a0a',
      text: '#f5f5f0',
      primary: '#ff4d2e',
      accent: '#ff4d2e',
      secondary: '#a3a3a3',
      styleKey: 'bright-bold',
      templateStyle: 'pf-agency',
    },
    palettes: [
      palette('Electric', '#0a0a14', '#f0f0ff', '#7c5cff', '#2de2e6', '#a3a3c2'),
      palette('Paper', '#f4f1ea', '#111111', '#e0301e', '#111111', '#555049'),
    ],
    preview: { name: 'Studio Ọ̀nà' },
    sections: [
      hero(
        'image-overlay',
        'Creative studio · Lagos',
        'We make brands, campaigns, and films for companies with something to say. Replace this with your studio’s line.',
        'Work with us',
      ),
      listPart('projects', 'modular', 'Work'),
      listPart('services', 'list', 'What we do'),
      listPart('clients', 'grid', 'Clients'),
      listPart('team', 'cards', 'The studio'),
      textPart(
        'contact',
        'details',
        'New business',
        'Tell brands how to brief you and who reads new enquiries.',
      ),
    ],
    items: [
      ...[
        ['Example Bank', 'Campaign · Film'],
        ['Sample Records', 'Identity'],
        ['Example Air', 'Campaign · Outdoor'],
        ['Sample Foods', 'Packaging'],
        ['Example Festival', 'Identity · Motion'],
        ['Sample Telecom', 'Social'],
      ].map(([title, subtitle]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        sampleFields: ['title', 'subtitle'],
      })),
      service('Brand identity', 'Names, logos, and systems that hold up everywhere.'),
      service('Campaigns', 'Ideas that travel from billboards to group chats.'),
      service('Film & motion', 'From script to final grade, in-house.'),
      service('Social', 'Always-on content with a point of view.'),
      ...['Sample client', 'Example Bank', 'Sample Records', 'Example Air'].map(client),
      {
        type: 'PERSON',
        title: 'Sample name',
        subtitle: 'Founder & creative director',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'PERSON',
        title: 'Sample name',
        subtitle: 'Head of design',
        sampleFields: ['title', 'subtitle'],
      },
    ],
  },
  {
    key: 'studio-atelier',
    name: 'Atelier',
    description:
      'Warm terracotta and olive with split colour blocks, for boutique and craft studios.',
    audience: 'Boutique & craft studios',
    audienceGroup: 'studio',
    defaultPreset: 'general',
    sortOrder: 21,
    tokens: {
      background: '#f6efe6',
      text: '#2e2a24',
      primary: '#a8461f',
      accent: '#6b7a3a',
      secondary: '#72675a',
      styleKey: 'warm-natural',
      templateStyle: 'pf-atelier',
    },
    palettes: [
      palette('Indigo dye', '#f2f1f7', '#1f1d33', '#3b3a8f', '#c27c3a', '#625f7a'),
      palette('Clay at night', '#231a15', '#f1e6da', '#e39a6e', '#a9b77a', '#b8a797'),
    ],
    preview: { name: 'Àṣà Atelier' },
    sections: [
      hero(
        'split',
        'Interior & furniture studio',
        'We design calm rooms and make furniture by hand in Abeokuta. Replace this with your studio’s line.',
        'Visit the studio',
      ),
      listPart('projects', 'featured', 'Selected work'),
      listPart('process', 'columns', 'Our approach'),
      listPart('services', 'cards', 'Services'),
      listPart('testimonials', 'quotes', 'Kind words'),
      textPart(
        'contact',
        'details',
        'Visit or write',
        'Share your email, studio address, and visiting hours.',
      ),
    ],
    items: [
      ...[
        ['A home for a family of five', 'Residential · Ibadan'],
        ['Café with reclaimed wood', 'Hospitality · Lagos'],
        ['The Iroko dining set', 'Furniture'],
        ['A quiet reading room', 'Residential · Abuja'],
      ].map(([title, subtitle]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        summary: 'Replace this with a sentence about the brief and what you made.',
        sampleFields: ['title', 'subtitle', 'summary'],
      })),
      step('Local first', 'We work with makers and materials from within 200 km of the studio.'),
      step('Made to last', 'Solid wood, honest joints, and finishes you can repair.'),
      step('Slow on purpose', 'Fewer projects a year, so each gets our full attention.'),
      service('Interior design', 'Full rooms, from layout to the last cushion.'),
      service('Custom furniture', 'Pieces made to measure in our workshop.'),
      service('Styling', 'A refresh for spaces that need a lift, not a rebuild.'),
      testimonial('Our house finally feels like us.', 'Sample name', 'Client, Ibadan'),
      testimonial(
        'Beautiful work, and they finished on the day they promised.',
        'Sample name',
        'Owner, Example Café',
      ),
    ],
  },

  // Academics & researchers ----------------------------------------------------------------
  {
    key: 'academic',
    name: 'Scholar',
    description: 'Calm navy and white in a citation-first layout that works as an online CV.',
    audience: 'Academics & researchers',
    audienceGroup: 'academic',
    defaultPreset: 'general',
    sortOrder: 22,
    tokens: {
      background: '#ffffff',
      text: '#1b2a41',
      primary: '#1b3a6b',
      accent: '#1b3a6b',
      secondary: '#566175',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-scholar',
    },
    palettes: [
      palette('Oxblood', '#fdfbf8', '#2a1d1d', '#7a1f2b', '#7a1f2b', '#6b5d5d'),
      palette('Green ink', '#f8fbf8', '#17261d', '#1f5f3f', '#1f5f3f', '#56665c'),
    ],
    preview: { name: 'Dr. Aisha Lawal' },
    sections: [
      hero(
        'split',
        'Senior Lecturer · Public Health',
        'I study how cities can reduce malaria through housing and drainage. Replace this with your title, institution, and research line.',
        'Contact me',
      ),
      textPart(
        'about',
        'text',
        'Research interests',
        'Describe your main research questions and methods in two short paragraphs a student could follow.',
      ),
      listPart('publications', 'citation', 'Publications'),
      listPart('services', 'list', 'Teaching'),
      listPart('awards', 'list', 'Awards & grants'),
      listPart('events', 'list', 'Talks'),
      textPart(
        'contact',
        'details',
        'Contact',
        'Your department, office, and the best way for students and collaborators to reach you.',
      ),
    ],
    items: [
      ...[
        [
          'Housing quality and malaria risk in three Nigerian cities',
          'Example Journal of Public Health',
          '2025-06-01',
        ],
        [
          'Drainage, rainfall, and mosquito breeding: a five-year study',
          'Sample Tropical Medicine Review',
          '2024-03-01',
        ],
        ['Community mapping for vector control', 'Example Global Health', '2023-09-01'],
        [
          'A field guide to urban malaria surveys',
          'Sample University Press (book chapter)',
          '2022-01-01',
        ],
      ].map(([title, subtitle, startsOn]): TemplateItem => ({
        type: 'PUBLICATION',
        title,
        subtitle,
        role: 'Lawal, A., Sample, B., and Example, C.',
        linkUrl: 'https://doi.org/10.0000/example',
        startsOn,
        sampleFields: ['title', 'subtitle', 'role', 'link_url'],
      })),
      service(
        'PHE 301: Epidemiology methods',
        'Third-year undergraduate course, first semester.',
        'Undergraduate',
      ),
      service(
        'PHE 712: Urban health',
        'Postgraduate seminar on cities and disease.',
        'Postgraduate',
      ),
      {
        type: 'AWARD',
        title: 'Early Career Research Grant',
        subtitle: 'Example Research Foundation',
        startsOn: '2024-01-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'AWARD',
        title: 'Best Paper Award',
        subtitle: 'Sample Public Health Conference',
        startsOn: '2023-11-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'EVENT',
        title: 'Keynote: Designing malaria out of our cities',
        subtitle: 'Example Health Summit, Abuja',
        startsOn: '2025-11-20',
        sampleFields: ['title', 'subtitle'],
      },
    ],
  },
  {
    key: 'academic-lab',
    name: 'Lab',
    description:
      'Modern and card-based, for researchers who lead a group and share their work widely.',
    audience: 'Research groups & labs',
    audienceGroup: 'academic',
    defaultPreset: 'general',
    sortOrder: 23,
    tokens: {
      background: '#fbfdfd',
      text: '#102a2e',
      primary: '#0f766e',
      accent: '#0e7490',
      secondary: '#4b6468',
      styleKey: 'professional-modern',
      templateStyle: 'pf-lab',
    },
    palettes: [
      palette('Violet', '#fcfbff', '#1d1a33', '#5b3cc4', '#c2410c', '#5f5b78'),
      palette('Lab at night', '#0d1b1e', '#e3f1f2', '#5eead4', '#7dd3fc', '#93adb1'),
    ],
    preview: { name: 'Soil & Water Lab' },
    sections: [
      hero(
        'centered',
        'Research group · Example University',
        'We study how farmers can grow more with less water as the climate changes. Replace this with your group’s research statement.',
        'Join or collaborate',
      ),
      listPart('services', 'cards', 'Research themes'),
      listPart('events', 'list', 'News'),
      listPart('publications', 'list', 'Recent publications'),
      listPart('team', 'cards', 'People'),
      textPart(
        'contact',
        'details',
        'Get in touch',
        'Tell students, funders, and collaborators how to reach the group.',
      ),
    ],
    items: [
      service('Soil moisture sensing', 'Low-cost sensors that tell farmers when to water.'),
      service('Drought-ready crops', 'Field trials of varieties that cope with dry spells.'),
      service('Farmer-led research', 'Working with cooperatives to test ideas on real farms.'),
      {
        type: 'EVENT',
        title: 'New grant for sensor trials in Kano',
        subtitle: 'News',
        startsOn: '2025-09-15',
        sampleFields: ['title'],
      },
      {
        type: 'EVENT',
        title: 'Two PhD places open for 2026',
        subtitle: 'News',
        startsOn: '2025-08-01',
        sampleFields: ['title'],
      },
      {
        type: 'EVENT',
        title: 'Our paper featured on Example Radio',
        subtitle: 'News',
        startsOn: '2025-05-10',
        sampleFields: ['title'],
      },
      ...[
        [
          'Cheap soil sensors for smallholder irrigation',
          'Example Agricultural Water Journal',
          '2025-04-01',
        ],
        ['Farmer cooperatives as research partners', 'Sample Development Studies', '2024-10-01'],
        ['Rainfall shifts in the Sahel, 1990–2023', 'Example Climate Letters', '2024-02-01'],
        ['Measuring water use on small farms', 'Sample Field Methods', '2023-06-01'],
      ].map(([title, subtitle, startsOn]): TemplateItem => ({
        type: 'PUBLICATION',
        title,
        subtitle,
        linkUrl: 'https://doi.org/10.0000/example',
        startsOn,
        sampleFields: ['title', 'subtitle', 'link_url'],
      })),
      {
        type: 'PERSON',
        title: 'Sample name',
        subtitle: 'Group lead',
        sampleFields: ['title'],
      },
      {
        type: 'PERSON',
        title: 'Sample name',
        subtitle: 'PhD researcher',
        sampleFields: ['title'],
      },
    ],
  },

  // Artists & illustrators ------------------------------------------------------------------
  {
    key: 'artist',
    name: 'Salon',
    description: 'Gallery walls: warm white, serif titles, and works shown with generous space.',
    audience: 'Artists & painters',
    audienceGroup: 'art',
    defaultPreset: 'fashion',
    sortOrder: 24,
    tokens: {
      background: '#faf7f2',
      text: '#22201c',
      primary: '#8a2c2c',
      accent: '#8a2c2c',
      secondary: '#6f675c',
      styleKey: 'elegant-luxury',
      templateStyle: 'pf-salon',
    },
    palettes: [
      palette('Night gallery', '#161514', '#eee9e1', '#d8b48a', '#d8b48a', '#a59d91'),
      palette('Blue room', '#f4f6f8', '#18202b', '#2a4d7a', '#2a4d7a', '#5a6573'),
    ],
    preview: { name: 'Olumide Adeniran' },
    sections: [
      hero(
        'split',
        'Painter',
        'Oil paintings of everyday rituals in Yoruba family life. Replace this with a line about your practice.',
        'Enquire about a work',
      ),
      listPart('projects', 'masonry', 'Works'),
      textPart(
        'about',
        'text',
        'Artist statement',
        'Write a short statement about what you make, why, and how. Keep it plain and personal.',
      ),
      listPart('awards', 'list', 'Exhibitions'),
      textPart(
        'contact',
        'details',
        'Commissions & enquiries',
        'Explain how collectors and galleries can reach you and whether you take commissions.',
      ),
    ],
    items: [
      ...[
        ['Sunday Rice', 'Oil on canvas · 120 × 90 cm · 2025'],
        ['Market Morning', 'Oil on canvas · 90 × 90 cm · 2025'],
        ['Grandmother’s Wrapper', 'Oil on linen · 60 × 80 cm · 2024'],
        ['Rainy Season', 'Oil on canvas · 100 × 140 cm · 2024'],
      ].map(([title, subtitle]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        sampleFields: ['title', 'subtitle'],
      })),
      {
        type: 'AWARD',
        title: 'Home Truths (solo exhibition)',
        subtitle: 'Example Gallery, Lagos',
        startsOn: '2025-03-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'AWARD',
        title: 'New Painters (group exhibition)',
        subtitle: 'Sample Art Centre, Accra',
        startsOn: '2024-06-01',
        sampleFields: ['title', 'subtitle'],
      },
    ],
  },
  {
    key: 'artist-sketchbook',
    name: 'Sketchbook',
    description: 'Playful colour, rounded shapes, and work grouped by market, for illustrators.',
    audience: 'Illustrators',
    audienceGroup: 'art',
    defaultPreset: 'beauty',
    sortOrder: 25,
    tokens: {
      background: '#fff9ef',
      text: '#27223a',
      primary: '#d6336c',
      accent: '#1c9c8f',
      secondary: '#625a80',
      styleKey: 'soft-friendly',
      templateStyle: 'pf-sketchbook',
    },
    palettes: [
      palette('Sky', '#f2f8ff', '#1b2440', '#2f6fe4', '#ff8a3d', '#56607d'),
      palette('Midnight crayon', '#1d1830', '#f6f0ff', '#ff7ab6', '#5ee0c8', '#b3a9d4'),
    ],
    preview: { name: 'Ada Illustrates' },
    sections: [
      hero(
        'centered',
        'Illustrator',
        'Bright, warm illustration for books, brands, and editorial. Replace this with a line about your style.',
        'Commission me',
      ),
      listPart('projects', 'grid', 'Work'),
      listPart('clients', 'strip', 'Clients'),
      textPart(
        'about',
        'text',
        'Hello!',
        'Say who you are, where you draw, and the kinds of projects you love.',
      ),
      listPart('services', 'cards', 'Commissions'),
      textPart(
        'contact',
        'details',
        'Say hello',
        'Tell art directors how to brief you and your usual turnaround.',
      ),
    ],
    items: [
      ...[
        ['Children’s book: Tobi and the Moon', 'Children’s books'],
        ['Magazine covers', 'Editorial'],
        ['Juice carton characters', 'Packaging'],
      ].map(([title, subtitle]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        summary: 'Replace this with a sentence about the brief.',
        sampleFields: ['title', 'summary'],
      })),
      ...['Sample client', 'Example Books', 'Sample Magazine', 'Example Juice'].map(client),
      service('Book illustration', 'Covers and inside spreads for picture books.', 'From ₦600,000'),
      service('Editorial', 'Spot and cover illustrations, usually within a week.', 'From ₦120,000'),
    ],
  },

  // Musicians & performers --------------------------------------------------------------------
  {
    key: 'musician',
    name: 'Stage',
    description:
      'Dark and poster-like with neon accents, built around your latest release and shows.',
    audience: 'Musicians & performers',
    audienceGroup: 'music',
    defaultPreset: 'general',
    sortOrder: 26,
    tokens: {
      background: '#0b0710',
      text: '#f4eefc',
      primary: '#ff2fb3',
      accent: '#3ad1ff',
      secondary: '#a99bbd',
      styleKey: 'bright-bold',
      templateStyle: 'pf-stage',
    },
    palettes: [
      palette('Electric blue', '#05070f', '#eef3ff', '#3ad1ff', '#ff2fb3', '#97a3c2'),
      palette('Gold record', '#0f0c06', '#f8f1e2', '#f5c542', '#ff5a36', '#b6aa92'),
    ],
    preview: { name: 'Lara Vibes' },
    sections: [
      hero(
        'image-overlay',
        'New single out now',
        'Afro-soul singer and songwriter from Port Harcourt. Replace this with a line about your sound.',
        'Listen',
        '#music',
      ),
      {
        key: 'music',
        type: 'embed',
        variant: 'player',
        content: { heading: 'Latest release', intro: '', url: '' },
        sampleFields: [],
      },
      listPart('events', 'poster', 'Shows'),
      textPart(
        'about',
        'text',
        'About',
        'Two or three sentences: where you are from, your sound, and what is next.',
      ),
      textPart(
        'contact',
        'details',
        'Booking',
        'Share the email for bookings and press, and your manager’s details if you have one.',
      ),
    ],
    items: [
      {
        type: 'EVENT',
        title: 'Live at Example Hall',
        subtitle: 'Victoria Island, Lagos',
        linkUrl: 'https://example.com/tickets',
        startsOn: '2026-12-12',
        sampleFields: ['title', 'subtitle', 'link_url'],
      },
      {
        type: 'EVENT',
        title: 'Sample Festival',
        subtitle: 'Port Harcourt',
        linkUrl: 'https://example.com/tickets',
        startsOn: '2027-01-18',
        sampleFields: ['title', 'subtitle', 'link_url'],
      },
      {
        type: 'EVENT',
        title: 'Example Lounge acoustic night',
        subtitle: 'Abuja',
        startsOn: '2026-08-02',
        sampleFields: ['title', 'subtitle'],
      },
    ],
  },
  {
    key: 'musician-epk',
    name: 'Press kit',
    description: 'A clean electronic press kit for bookers and press: bios, quotes, and downloads.',
    audience: 'Artists seeking bookings & press',
    audienceGroup: 'music',
    defaultPreset: 'general',
    sortOrder: 27,
    tokens: {
      background: '#ffffff',
      text: '#161616',
      primary: '#5b2be0',
      accent: '#5b2be0',
      secondary: '#5f5f5f',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-press-kit',
    },
    palettes: [
      palette('Oxide', '#fbf8f5', '#1d1612', '#b5371c', '#b5371c', '#65574e'),
      palette('After hours', '#111014', '#f1eff5', '#b49cff', '#b49cff', '#a29fae'),
    ],
    preview: { name: 'The Lagos Strings' },
    sections: [
      hero(
        'centered',
        'Press kit',
        'Highlife strings quartet reimagining classic Nigerian songs for concert halls. Replace this with your one-line bio.',
        'Booking enquiries',
      ),
      {
        key: 'music',
        type: 'embed',
        variant: 'player',
        content: { heading: 'Listen', intro: '', url: '' },
        sampleFields: [],
      },
      {
        key: 'bios',
        type: 'bios',
        variant: 'stacked',
        content: {
          heading: 'Bios',
          oneLiner: 'A strings quartet playing highlife classics for concert halls.',
          short:
            'Formed in Lagos in 2019, the quartet arranges highlife and juju classics for strings. They have played festivals across West Africa and released two albums.',
          long: 'Write a longer bio here, four to six sentences: how you started, key releases, notable shows, collaborations, and what is coming next. Bookers and journalists copy this word for word, so write it in the third person.',
        },
        sampleFields: ['oneLiner', 'short', 'long'],
      },
      listPart('testimonials', 'quotes', 'Press'),
      listPart('downloads', 'buttons', 'Press photos & files'),
      listPart('events', 'list', 'Upcoming shows'),
      textPart(
        'contact',
        'details',
        'Booking, press & management',
        'List who handles bookings, press, and management, with an email for each.',
      ),
    ],
    items: [
      testimonial(
        'A thrilling, joyful reinvention of songs we thought we knew.',
        'Sample critic',
        'Example Arts Weekly',
      ),
      testimonial(
        'The best live act at this year’s festival.',
        'Sample critic',
        'Sample Music Blog',
      ),
      testimonial('Elegant and full of life.', 'Sample critic', 'Example Daily'),
      {
        type: 'LINK',
        title: 'Press photos (high resolution)',
        subtitle: 'Zip, 12 MB',
        linkUrl: 'https://example.com/press-photos',
        sampleFields: ['link_url'],
      },
      {
        type: 'LINK',
        title: 'Technical rider',
        subtitle: 'PDF',
        linkUrl: 'https://example.com/rider',
        sampleFields: ['link_url'],
      },
      {
        type: 'EVENT',
        title: 'Example Concert Hall',
        subtitle: 'Lagos',
        linkUrl: 'https://example.com/tickets',
        startsOn: '2026-12-05',
        sampleFields: ['title', 'subtitle', 'link_url'],
      },
      {
        type: 'EVENT',
        title: 'Sample Jazz Festival',
        subtitle: 'Accra',
        startsOn: '2027-02-20',
        sampleFields: ['title', 'subtitle'],
      },
    ],
  },

  // Architects & interior designers -------------------------------------------------------------
  {
    key: 'architect',
    name: 'Monograph',
    description: 'Restrained black and white on a strict grid, letting buildings carry the page.',
    audience: 'Architects',
    audienceGroup: 'architecture',
    defaultPreset: 'general',
    sortOrder: 28,
    tokens: {
      background: '#ffffff',
      text: '#111111',
      primary: '#111111',
      accent: '#c23b22',
      secondary: '#6a6a6a',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-monograph',
    },
    palettes: [
      palette('Concrete', '#ecebe8', '#1a1a1a', '#1a1a1a', '#1f5fa8', '#5e5d5a'),
      palette('Black box', '#0f0f0f', '#ededed', '#ededed', '#ff5a3c', '#9b9b9b'),
    ],
    preview: { name: 'Okafor Architects' },
    sections: [
      hero(
        'centered',
        'Architecture',
        'Homes, schools, and public buildings designed for heat, light, and community. Replace this with your practice’s line.',
        'Start a conversation',
      ),
      listPart('projects', 'grid', 'Projects'),
      textPart(
        'about',
        'text',
        'Practice',
        'Describe your practice, who leads it, and the ideas that guide your buildings.',
      ),
      listPart('services', 'list', 'Services'),
      listPart('awards', 'compact', 'Recognition'),
      textPart('contact', 'details', 'Contact', 'Share your studio address, email, and phone.'),
    ],
    items: [
      ...[
        ['Courtyard House', 'Residential · Enugu · 2025', 'Lead architect · Completed'],
        ['Community Library', 'Civic · Kaduna · 2024', 'Design architect · Completed'],
        ['Breeze School', 'Education · Ogun · 2023', 'Lead architect · Under construction'],
      ].map(([title, subtitle, role]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        role,
        summary: 'Replace this with a sentence about the brief, the site, and your idea.',
        sampleFields: ['title', 'subtitle', 'role', 'summary'],
      })),
      service('Architecture', 'From feasibility to completion on site.'),
      service('Masterplanning', 'Layouts for estates, campuses, and neighbourhoods.'),
      service('Retrofit', 'Cooler, brighter, longer-lasting existing buildings.'),
      {
        type: 'AWARD',
        title: 'Shortlist, Example Architecture Prize',
        subtitle: 'Community Library',
        startsOn: '2025-05-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'AWARD',
        title: 'Sample Housing Award',
        subtitle: 'Courtyard House',
        startsOn: '2025-10-01',
        sampleFields: ['title', 'subtitle'],
      },
    ],
  },
  {
    key: 'architect-material',
    name: 'Material',
    description: 'Warm stone, clay, and oak tones with large imagery, for interiors and homes.',
    audience: 'Interior designers',
    audienceGroup: 'architecture',
    defaultPreset: 'fashion',
    sortOrder: 29,
    tokens: {
      background: '#f3eee7',
      text: '#2b2622',
      primary: '#7f4f33',
      accent: '#6f7d5c',
      secondary: '#72675d',
      styleKey: 'warm-natural',
      templateStyle: 'pf-material',
    },
    palettes: [
      palette('Limewash', '#f7f6f2', '#24262a', '#4b5d6b', '#a67c52', '#6b6e72'),
      palette('Walnut', '#1e1915', '#efe7dd', '#d9a77c', '#a9b48d', '#b3a596'),
    ],
    preview: { name: 'Halima Interiors' },
    sections: [
      hero(
        'image-overlay',
        'Interior design',
        'Warm, practical homes that feel like the people who live in them. Replace this with your own line.',
        'Book a consultation',
      ),
      listPart('projects', 'featured', 'Projects'),
      listPart('process', 'columns', 'How we work'),
      listPart('services', 'cards', 'Services'),
      listPart('testimonials', 'quotes', 'Clients say'),
      textPart(
        'contact',
        'details',
        'Book a consultation',
        'Share how clients can reach you and what a first consultation includes.',
      ),
    ],
    items: [
      ...[
        ['Lekki family home', 'Residential · 2025'],
        ['Garden flat in Ikoyi', 'Residential · 2024'],
        ['Boutique hotel lobby', 'Hospitality · 2024'],
      ].map(([title, subtitle]): TemplateItem => ({
        type: 'PROJECT',
        title,
        subtitle,
        summary: 'Replace this with a sentence about the brief and the result.',
        sampleFields: ['title', 'subtitle', 'summary'],
      })),
      step('Concept', 'We listen, visit, and bring you a mood board and layout to react to.'),
      step('Design', 'Drawings, materials, and a clear budget you approve before we buy.'),
      step('Build', 'We manage the trades and style every room until it is finished.'),
      service('Full interiors', 'Whole homes, start to finish.'),
      service('Single rooms', 'One room done properly, in weeks.'),
      service('Consultations', 'Two hours of advice and a written plan.'),
      testimonial(
        'Every room works for our family and still feels calm.',
        'Sample name',
        'Client, Lekki',
      ),
      testimonial('On time and on budget. Rare and wonderful.', 'Sample name', 'Client, Ikoyi'),
    ],
  },

  // Job seekers ---------------------------------------------------------------------------------
  {
    key: 'resume',
    name: 'One page',
    description: 'A crisp one-page CV that recruiters can scan quickly and print cleanly.',
    audience: 'Job seekers',
    audienceGroup: 'job',
    defaultPreset: 'general',
    sortOrder: 30,
    tokens: {
      background: '#ffffff',
      text: '#1d2733',
      primary: '#1f3a64',
      accent: '#b7791f',
      secondary: '#5b6b82',
      styleKey: 'clean-minimal',
      templateStyle: 'pf-one-page',
    },
    palettes: [],
    preview: { name: 'Tobi Adebayo' },
    sections: [
      hero(
        'centered',
        'Open to new opportunities',
        'Write a short professional summary: your role, years of experience, and what you are best at.',
        'Contact me',
      ),
      textPart(
        'about',
        'text',
        'Profile',
        'Summarise your background, strengths, and the kind of role you want next.',
      ),
      listPart('experience', 'timeline', 'Work experience'),
      listPart('education', 'timeline', 'Education'),
      listPart('skills', 'tags', 'Skills'),
      listPart('awards', 'compact', 'Certifications'),
      listPart('downloads', 'buttons', 'My CV'),
      textPart(
        'contact',
        'details',
        'Get in touch',
        'Let recruiters know the best way to reach you.',
      ),
    ],
    items: [
      {
        type: 'EXPERIENCE',
        title: 'Operations Associate',
        subtitle: 'Example Company, Lagos',
        summary: 'Coordinated daily operations for a team of 12 and cut order errors by a third.',
        startsOn: '2023-03-01',
        isCurrent: true,
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Customer Support Officer',
        subtitle: 'Sample Bank, Abuja',
        summary:
          'Resolved customer issues by phone and chat, consistently above the team satisfaction target.',
        startsOn: '2021-01-01',
        endsOn: '2023-02-01',
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'EDUCATION',
        title: 'B.Sc. Business Administration',
        subtitle: 'Example University',
        summary: 'Second Class Upper.',
        startsOn: '2016-09-01',
        endsOn: '2020-07-01',
        sampleFields: ['title', 'subtitle', 'summary'],
      },
      {
        type: 'SKILL',
        title: 'Skills',
        tags: ['Customer service', 'Microsoft Excel', 'Team coordination', 'Reporting'],
        sampleFields: ['tags'],
      },
      {
        type: 'AWARD',
        title: 'Google Data Analytics Certificate',
        subtitle: 'Example learning platform',
        startsOn: '2024-05-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'AWARD',
        title: 'Project Management Foundations',
        subtitle: 'Sample Institute',
        startsOn: '2023-08-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'LINK',
        title: 'Download my CV',
        subtitle: 'PDF',
        linkUrl: 'https://example.com/cv.pdf',
        sampleFields: ['link_url'],
      },
    ],
  },
  {
    key: 'resume-sidebar',
    name: 'Sidebar CV',
    description: 'A modern two-column CV with your contact details always in view.',
    audience: 'Job seekers',
    audienceGroup: 'job',
    defaultPreset: 'general',
    sortOrder: 31,
    tokens: {
      background: '#ffffff',
      text: '#1d2433',
      primary: '#24507a',
      accent: '#d97706',
      secondary: '#5b6577',
      styleKey: 'professional-modern',
      templateStyle: 'pf-sidebar',
    },
    palettes: [
      palette('Teal', '#ffffff', '#16282b', '#0f6b6b', '#c2410c', '#55676a'),
      palette('Graphite', '#f7f7f8', '#1c1c21', '#3f3f46', '#2563eb', '#5f5f69'),
    ],
    preview: { name: 'Amina Yusuf' },
    sections: [
      hero(
        'centered',
        'Data analyst',
        'Data analyst with four years of experience turning messy spreadsheets into decisions. Replace this with your summary.',
        'Email me',
      ),
      textPart('contact', 'details', 'Contact', 'Lagos, Nigeria. Open to remote and hybrid roles.'),
      listPart('experience', 'timeline', 'Experience'),
      listPart('projects', 'list', 'Projects'),
      listPart('education', 'compact', 'Education'),
      listPart('skills', 'grouped', 'Skills & languages'),
      listPart('downloads', 'buttons', 'CV'),
    ],
    items: [
      {
        type: 'EXPERIENCE',
        title: 'Data Analyst',
        subtitle: 'Example Retail, Lagos',
        summary: 'Built weekly sales dashboards used by 30 store managers.',
        startsOn: '2023-01-01',
        isCurrent: true,
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Junior Analyst',
        subtitle: 'Sample Insurance, Lagos',
        summary: 'Automated monthly claims reports, saving two days of manual work.',
        startsOn: '2021-02-01',
        endsOn: '2022-12-01',
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'EXPERIENCE',
        title: 'Volunteer maths tutor',
        subtitle: 'Example Community Centre',
        summary: 'Weekend tutoring for secondary school students.',
        startsOn: '2019-01-01',
        endsOn: '2021-01-01',
        sampleFields: ['subtitle', 'summary'],
      },
      {
        type: 'PROJECT',
        title: 'Fuel price tracker',
        subtitle: 'Side project',
        summary: 'A public dashboard of pump prices across 36 states.',
        linkUrl: 'https://example.com/fuel-tracker',
        tags: ['Python', 'Power BI'],
        sampleFields: ['title', 'summary', 'link_url'],
      },
      {
        type: 'EDUCATION',
        title: 'B.Sc. Statistics',
        subtitle: 'Example University',
        startsOn: '2015-09-01',
        endsOn: '2019-07-01',
        sampleFields: ['title', 'subtitle'],
      },
      {
        type: 'SKILL',
        title: 'Skills',
        tags: ['SQL', 'Python', 'Power BI', 'Excel', 'Storytelling with data'],
        sampleFields: ['tags'],
      },
      {
        type: 'SKILL',
        title: 'Languages',
        tags: ['English (fluent)', 'Hausa (native)', 'French (basic)'],
        sampleFields: ['tags'],
      },
      {
        type: 'LINK',
        title: 'Download my CV',
        subtitle: 'PDF',
        linkUrl: 'https://example.com/cv.pdf',
        sampleFields: ['link_url'],
      },
    ],
  },

  // Coaches & speakers ---------------------------------------------------------------------------
  {
    key: 'coach-speaker',
    name: 'Keynote',
    description:
      'Bold purple and orange with a reel up top, made for event planners booking speakers.',
    audience: 'Speakers',
    audienceGroup: 'coaching',
    defaultPreset: 'general',
    sortOrder: 32,
    tokens: {
      background: '#1e1036',
      text: '#f7f3ff',
      primary: '#ff8a3d',
      accent: '#ff8a3d',
      secondary: '#b9a8d9',
      styleKey: 'bright-bold',
      templateStyle: 'pf-keynote',
    },
    palettes: [
      palette('Daylight stage', '#fffaf5', '#24123d', '#5b21b6', '#ea580c', '#5f5175'),
      palette('Teal spotlight', '#06201f', '#eafaf7', '#2dd4bf', '#fbbf24', '#9ec2bd'),
    ],
    preview: { name: 'Kunle Oyelaran' },
    sections: [
      hero(
        'split',
        'Keynote speaker',
        'I help teams lead through change with stories from 15 years building companies in Africa. Replace this with your promise to audiences.',
        'Book me to speak',
      ),
      {
        key: 'reel',
        type: 'embed',
        variant: 'player',
        content: { heading: 'Watch me speak', intro: '', url: '' },
        sampleFields: [],
      },
      listPart('services', 'cards', 'Talks'),
      listPart('clients', 'strip', 'Where I’ve spoken'),
      listPart('testimonials', 'quotes', 'From organisers'),
      textPart(
        'about',
        'photo-right',
        'About',
        'A short bio in the third person that organisers can read out before you speak.',
      ),
      listPart('downloads', 'buttons', 'For organisers'),
      textPart(
        'contact',
        'details',
        'Bookings',
        'Share the booking email, your usual fee range, and how far ahead to book.',
      ),
    ],
    items: [
      service(
        'Leading when nothing is certain',
        'For leadership teams facing restructuring or fast growth.',
        'Keynote · 45 minutes',
      ),
      service(
        'Building trust in hybrid teams',
        'Practical habits for managers of remote and office staff.',
        'Workshop · half day',
      ),
      service(
        'From side hustle to company',
        'For founders and young professionals.',
        'Talk · 30 minutes',
      ),
      ...[
        'Sample summit',
        'Example Bank leadership retreat',
        'Sample Tech Week',
        'Example University',
      ].map(client),
      testimonial(
        'The highest-rated session of our conference two years running.',
        'Sample name',
        'Events Lead, Sample Summit',
      ),
      testimonial(
        'Our managers are still quoting him months later.',
        'Sample name',
        'HR Director, Example Bank',
      ),
      {
        type: 'LINK',
        title: 'Speaker one-sheet',
        subtitle: 'PDF',
        linkUrl: 'https://example.com/one-sheet.pdf',
        sampleFields: ['link_url'],
      },
    ],
  },
  {
    key: 'coach-warm',
    name: 'Warm coach',
    description: 'Soft sage and cream with rounded shapes, for life, career, and wellness coaches.',
    audience: 'Coaches',
    audienceGroup: 'coaching',
    defaultPreset: 'beauty',
    sortOrder: 33,
    tokens: {
      background: '#f7f4ec',
      text: '#273127',
      primary: '#466e51',
      accent: '#d9925a',
      secondary: '#636d5c',
      styleKey: 'soft-friendly',
      templateStyle: 'pf-warm-coach',
    },
    palettes: [
      palette('Blush', '#fbf4f2', '#3a2228', '#a23e5a', '#e0a35a', '#755e63'),
      palette('Evening', '#1d211d', '#eef2ea', '#9fd1a8', '#f0b27a', '#a9b3a4'),
    ],
    preview: { name: 'Coach Chioma' },
    sections: [
      hero(
        'split',
        'Career coach',
        'I help women in their thirties find work that fits the life they want. Replace this with the promise you make clients.',
        'Book a free call',
      ),
      listPart('services', 'cards', 'Programmes'),
      listPart('process', 'numbered', 'How it works'),
      listPart('testimonials', 'spotlight', 'Client stories'),
      textPart(
        'about',
        'photo-left',
        'About me',
        'Share your story: why you coach, your training, and who you work best with.',
      ),
      textPart(
        'contact',
        'details',
        'Let’s talk',
        'Invite people to email you for a free 20-minute call.',
      ),
    ],
    items: [
      service('Clarity session', 'One 90-minute session to choose your next step.', '₦60,000'),
      service('Career reset', 'Eight weekly sessions to plan and land a new role.', '₦380,000'),
      service(
        'Leadership circle',
        'A small group for new managers, meeting monthly.',
        '₦45,000 / month',
      ),
      step('Free call', 'Twenty minutes to see whether we are a good fit.'),
      step('Your plan', 'We agree goals and a schedule that suits your week.'),
      step('Sessions', 'Online or in person, with notes and small tasks between.'),
      testimonial(
        'I left a job I had outgrown and found one I love, in four months.',
        'Sample name',
        'Product manager',
      ),
      testimonial(
        'Chioma asks the questions you have been avoiding, kindly.',
        'Sample name',
        'Teacher turned founder',
      ),
      testimonial('Worth every session.', 'Sample name', 'Bank manager'),
    ],
  },
];

export function libraryTemplate(key: string) {
  return portfolioTemplateLibrary.find((template) => template.key === key);
}

/** "What do you do?" groups, in the order the gallery and guided start show them. */
export const audienceGroups: Array<{ value: string; label: string; example: string }> = [
  { value: 'software', label: 'I build software', example: 'Software engineer' },
  { value: 'design', label: 'I design products or brands', example: 'Product designer' },
  { value: 'visual', label: 'I take photographs', example: 'Photographer' },
  { value: 'writing', label: 'I write', example: 'Journalist' },
  { value: 'freelance', label: 'I freelance or consult', example: 'Brand strategist' },
  { value: 'studio', label: 'I run a creative studio', example: 'Creative studio' },
  { value: 'academic', label: 'I teach or do research', example: 'Senior lecturer' },
  { value: 'art', label: 'I make art or illustrations', example: 'Illustrator' },
  { value: 'music', label: 'I make music or perform', example: 'Singer-songwriter' },
  { value: 'architecture', label: 'I design buildings or interiors', example: 'Architect' },
  { value: 'job', label: 'I am looking for a job', example: 'Operations associate' },
  { value: 'coaching', label: 'I coach or speak', example: 'Career coach' },
];
