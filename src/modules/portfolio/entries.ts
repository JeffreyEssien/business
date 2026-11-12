/**
 * Plain-language wording and field rules for portfolio entries and page parts.
 * This is the single source for everything the owner reads in the builder
 * (docs/plans/portfolio-templates.md §5). The database independently validates values.
 */

export const entryTypes = [
  'PROJECT',
  'EXPERIENCE',
  'EDUCATION',
  'SKILL',
  'PUBLICATION',
  'SERVICE',
  'TESTIMONIAL',
  'EVENT',
  'AWARD',
  'CLIENT',
  'STAT',
  'STEP',
  'LINK',
  'PERSON',
] as const;
export type EntryType = (typeof entryTypes)[number];

export type EntryField =
  | 'title'
  | 'subtitle'
  | 'summary'
  | 'role'
  | 'outcome'
  | 'linkUrl'
  | 'sourceUrl'
  | 'tags'
  | 'dates';

type FieldCopy = { label: string; hint: string; required?: boolean };

export const entryCopy: Record<
  EntryType,
  {
    /** URL segment for ?show= on the entries page. */
    param: string;
    plural: string;
    singular: string;
    addLabel: string;
    emptyHint: string;
    currentLabel?: string;
    /** How the "When" field is asked: a from–to range (default), one month, or one day. */
    dateStyle?: 'range' | 'month' | 'day';
    /** Whether this kind of entry can have a picture (cover or portrait). */
    photo?: { label: string; hint: string };
    fields: Partial<Record<EntryField, FieldCopy>>;
  }
> = {
  PROJECT: {
    param: 'projects',
    plural: 'Projects',
    singular: 'project',
    addLabel: 'Add a project',
    emptyHint:
      'Add the work you are proudest of. Two or three strong projects are better than ten.',
    photo: {
      label: 'Cover picture (optional)',
      hint: 'A screenshot, photo, or design that shows this project at a glance.',
    },
    fields: {
      title: { label: 'Project name', hint: 'e.g. Savings app sign-up redesign', required: true },
      subtitle: { label: 'Type of project', hint: 'e.g. Web app, Case study, Photo series' },
      summary: { label: 'What it is', hint: 'One or two sentences a stranger would understand.' },
      role: { label: 'What you did', hint: 'e.g. Designed the screens and ran user interviews.' },
      outcome: {
        label: 'The result (optional)',
        hint: 'Only real results, e.g. "Sign-ups went up by a third". Leave empty if unsure.',
      },
      linkUrl: { label: 'Link to see it (optional)', hint: 'Paste any web address.' },
      sourceUrl: {
        label: 'Second link (optional)',
        hint: 'e.g. the code on GitHub, or a write-up.',
      },
      tags: { label: 'Tools or topics', hint: 'Separate with commas, e.g. Figma, Research' },
    },
  },
  EXPERIENCE: {
    param: 'jobs',
    plural: 'Work experience',
    singular: 'job',
    addLabel: 'Add a job',
    emptyHint: 'Add the roles you want people to know about, most recent first.',
    currentLabel: 'I work here now',
    fields: {
      title: { label: 'Job title', hint: 'e.g. Software Engineer', required: true },
      subtitle: { label: 'Company and city', hint: 'e.g. Paystack, Lagos' },
      summary: {
        label: 'What you did there',
        hint: 'One or two sentences. Mention a result if you have one.',
      },
      dates: { label: 'When', hint: 'Month and year are enough.' },
    },
  },
  EDUCATION: {
    param: 'education',
    plural: 'Education',
    singular: 'qualification',
    addLabel: 'Add education',
    emptyHint: 'Add degrees, diplomas, or courses that matter for the work you want.',
    currentLabel: 'I am still studying here',
    fields: {
      title: { label: 'Qualification', hint: 'e.g. B.Sc. Computer Science', required: true },
      subtitle: { label: 'School', hint: 'e.g. University of Lagos' },
      summary: { label: 'Grade or highlights (optional)', hint: 'e.g. Second Class Upper' },
      dates: { label: 'When', hint: 'Month and year are enough.' },
    },
  },
  SKILL: {
    param: 'skills',
    plural: 'Skills',
    singular: 'skill group',
    addLabel: 'Add a skill group',
    emptyHint: 'Group your skills, e.g. "Languages" or "Tools", so they are quick to scan.',
    fields: {
      title: { label: 'Group name', hint: 'e.g. Languages, Tools, What I do', required: true },
      tags: { label: 'Your skills', hint: 'Separate with commas, e.g. Python, SQL, Excel' },
    },
  },
  PUBLICATION: {
    param: 'writing',
    plural: 'Writing & publications',
    singular: 'piece',
    addLabel: 'Add a piece of writing',
    emptyHint: 'Add articles, essays, papers, or talks. Your best three recent pieces matter most.',
    dateStyle: 'month',
    fields: {
      title: { label: 'Title', hint: 'e.g. Why Lagos traffic is a data problem', required: true },
      subtitle: {
        label: 'Where it appeared',
        hint: 'e.g. BusinessDay, a journal, a conference, or your newsletter',
      },
      role: {
        label: 'Authors (optional)',
        hint: 'For papers with co-authors, e.g. Okafor, A. and Bello, K.',
      },
      summary: { label: 'One-line summary (optional)', hint: 'What a reader will get from it.' },
      linkUrl: { label: 'Link to read it (optional)', hint: 'Paste the web address.' },
      tags: { label: 'Topic', hint: 'e.g. Technology. Pieces with the same topic are grouped.' },
      dates: { label: 'When it was published', hint: 'Month and year are enough.' },
    },
  },
  SERVICE: {
    param: 'services',
    plural: 'Services',
    singular: 'service',
    addLabel: 'Add a service',
    emptyHint:
      'Describe what people can hire you for, in their words: the problem you solve for them.',
    fields: {
      title: { label: 'Name', hint: 'e.g. Brand identity, or 8-week career reset', required: true },
      subtitle: {
        label: 'Who it is for or price (optional)',
        hint: 'e.g. For new founders · From ₦250,000',
      },
      summary: {
        label: 'What they get',
        hint: 'One or two sentences about the result, not the process.',
      },
    },
  },
  TESTIMONIAL: {
    param: 'testimonials',
    plural: 'Testimonials',
    singular: 'testimonial',
    addLabel: 'Add a testimonial',
    emptyHint: 'Add real words from clients, editors, or reviewers. Specific praise works best.',
    fields: {
      summary: {
        label: 'What they said',
        hint: 'Paste their words exactly. Short and specific is best.',
      },
      title: { label: 'Their name', hint: 'e.g. Amaka Obi', required: true },
      subtitle: { label: 'Their role or publication', hint: 'e.g. Founder, Bloom Foods' },
      linkUrl: { label: 'Link to the source (optional)', hint: 'e.g. the review online.' },
    },
  },
  EVENT: {
    param: 'events',
    plural: 'Events & dates',
    singular: 'event',
    addLabel: 'Add an event',
    emptyHint: 'Add shows, talks, exhibitions, or news. Past dates move to "Recent" by themselves.',
    dateStyle: 'day',
    fields: {
      title: { label: 'What it is', hint: 'e.g. Live at Terra Kulture', required: true },
      subtitle: { label: 'Where', hint: 'e.g. Victoria Island, Lagos' },
      summary: { label: 'Details (optional)', hint: 'One sentence visitors should know.' },
      linkUrl: { label: 'Tickets or more information (optional)', hint: 'Paste the link.' },
      dates: { label: 'Date', hint: 'The day it happens.' },
    },
  },
  AWARD: {
    param: 'awards',
    plural: 'Awards & certificates',
    singular: 'award',
    addLabel: 'Add an award or certificate',
    emptyHint: 'Add prizes, recognition, exhibitions, or certifications.',
    dateStyle: 'month',
    fields: {
      title: { label: 'Name', hint: 'e.g. Google Data Analytics Certificate', required: true },
      subtitle: { label: 'Given by', hint: 'e.g. Coursera, or the organisation' },
      summary: { label: 'Note (optional)', hint: 'e.g. One of 12 chosen from 900 entries.' },
      linkUrl: { label: 'Link (optional)', hint: 'e.g. where it can be verified.' },
      dates: { label: 'When', hint: 'Month and year are enough.' },
    },
  },
  CLIENT: {
    param: 'clients',
    plural: 'Clients',
    singular: 'client',
    addLabel: 'Add a client',
    emptyHint: 'Add the organisations or events you have worked with, by name.',
    fields: {
      title: { label: 'Name', hint: 'e.g. Flutterwave, or TEDxLagos', required: true },
      linkUrl: { label: 'Their website (optional)', hint: 'Paste the web address.' },
    },
  },
  STAT: {
    param: 'figures',
    plural: 'Key figures',
    singular: 'figure',
    addLabel: 'Add a figure',
    emptyHint: 'Add two or three real numbers people should remember. Never invent them.',
    fields: {
      title: { label: 'The number', hint: 'e.g. 40+, ₦2bn, or 12 years', required: true },
      summary: { label: 'What it means', hint: 'e.g. brands launched' },
    },
  },
  STEP: {
    param: 'steps',
    plural: 'Steps',
    singular: 'step',
    addLabel: 'Add a step',
    emptyHint: 'Explain how working with you goes, in three or four steps.',
    fields: {
      title: { label: 'Step name', hint: 'e.g. A free first call', required: true },
      summary: { label: 'What happens', hint: 'One or two sentences.' },
    },
  },
  LINK: {
    param: 'downloads',
    plural: 'Downloads',
    singular: 'download',
    addLabel: 'Add a download',
    emptyHint: 'Link to files you keep elsewhere, e.g. your CV or press kit on Google Drive.',
    fields: {
      title: { label: 'Button text', hint: 'e.g. Download my CV', required: true },
      linkUrl: {
        label: 'Link to the file',
        hint: 'Paste a share link, e.g. from Google Drive or Dropbox.',
        required: true,
      },
      subtitle: { label: 'File type (optional)', hint: 'e.g. PDF, 2 pages' },
    },
  },
  PERSON: {
    param: 'people',
    plural: 'People',
    singular: 'person',
    addLabel: 'Add a person',
    emptyHint: 'Add your team members or collaborators.',
    photo: {
      label: 'Photo (optional)',
      hint: 'A clear, friendly photo of their face.',
    },
    fields: {
      title: { label: 'Name', hint: 'e.g. Tunde Bakare', required: true },
      subtitle: { label: 'Role', hint: 'e.g. Creative director' },
      summary: { label: 'Short bio (optional)', hint: 'One sentence.' },
      linkUrl: { label: 'Link (optional)', hint: 'e.g. their LinkedIn page.' },
    },
  },
};

export function entryTypeFromParam(value: string | undefined): EntryType {
  return entryTypes.find((type) => entryCopy[type].param === value) ?? 'PROJECT';
}

export function isEntryType(value: unknown): value is EntryType {
  return typeof value === 'string' && (entryTypes as readonly string[]).includes(value);
}

/** Database column names used in example tracking, mapped to the form's field names. */
export const sampleColumnToField: Record<string, EntryField> = {
  title: 'title',
  subtitle: 'subtitle',
  summary: 'summary',
  role: 'role',
  outcome: 'outcome',
  link_url: 'linkUrl',
  source_url: 'sourceUrl',
  tags: 'tags',
};

/** Layout ("look") choices per page part, in plain words. Mirrors the database allow-list. */
export const partLooks: Record<string, Array<{ value: string; label: string }>> = {
  hero: [
    { value: 'centered', label: 'Centred' },
    { value: 'split', label: 'Text beside a picture' },
    { value: 'image-overlay', label: 'Text over a big picture' },
  ],
  about: [
    { value: 'text', label: 'Text only' },
    { value: 'photo-left', label: 'Photo on the left' },
    { value: 'photo-right', label: 'Photo on the right' },
  ],
  projects: [
    { value: 'grid', label: 'Cards in a grid' },
    { value: 'featured', label: 'Large, one after another' },
    { value: 'masonry', label: 'Picture wall' },
    { value: 'list', label: 'Simple list' },
    { value: 'case-study', label: 'Story: what, my role, the result' },
    { value: 'modular', label: 'Mixed-size tiles' },
  ],
  experience: [
    { value: 'timeline', label: 'Timeline' },
    { value: 'compact', label: 'Compact list' },
  ],
  education: [
    { value: 'timeline', label: 'Timeline' },
    { value: 'compact', label: 'Compact list' },
  ],
  skills: [
    { value: 'tags', label: 'All together' },
    { value: 'grouped', label: 'In their groups' },
  ],
  contact: [{ value: 'details', label: 'Contact details' }],
  publications: [
    { value: 'list', label: 'List with where it appeared' },
    { value: 'editorial', label: 'Grouped by topic' },
    { value: 'index', label: 'Titles and years only' },
    { value: 'citation', label: 'Academic citations' },
  ],
  services: [
    { value: 'cards', label: 'Cards' },
    { value: 'list', label: 'Simple list' },
  ],
  testimonials: [
    { value: 'quotes', label: 'Quotes side by side' },
    { value: 'spotlight', label: 'One large quote at a time' },
  ],
  events: [
    { value: 'list', label: 'Dates in a list' },
    { value: 'poster', label: 'Big dates, like a poster' },
  ],
  awards: [
    { value: 'list', label: 'List with details' },
    { value: 'compact', label: 'Compact list' },
  ],
  clients: [
    { value: 'strip', label: 'Names in a row' },
    { value: 'grid', label: 'Names in boxes' },
  ],
  stats: [
    { value: 'figures', label: 'Big numbers' },
    { value: 'band', label: 'Numbers on a coloured band' },
  ],
  process: [
    { value: 'numbered', label: 'Numbered steps' },
    { value: 'columns', label: 'Steps side by side' },
  ],
  downloads: [{ value: 'buttons', label: 'Buttons' }],
  team: [
    { value: 'cards', label: 'Photo cards' },
    { value: 'list', label: 'Simple list' },
  ],
  embed: [{ value: 'player', label: 'Player' }],
  bios: [{ value: 'stacked', label: 'One after another' }],
  cta: [
    { value: 'banner', label: 'Coloured banner' },
    { value: 'centered', label: 'Centred, no background' },
  ],
};

/** Parts an owner can add from the "Add a part" menu. */
export const addablePartTypes = [
  'about',
  'projects',
  'experience',
  'education',
  'skills',
  'services',
  'testimonials',
  'publications',
  'events',
  'awards',
  'clients',
  'stats',
  'process',
  'team',
  'downloads',
  'embed',
  'bios',
  'cta',
  'contact',
] as const;

/** The first parts in the "Add a part" menu; the rest sit under "More". */
export const commonPartTypes = ['about', 'projects', 'services', 'testimonials', 'contact'];

/** Which entry type fills an entry-backed part. */
export const partEntryType: Record<string, EntryType> = {
  projects: 'PROJECT',
  experience: 'EXPERIENCE',
  education: 'EDUCATION',
  skills: 'SKILL',
  publications: 'PUBLICATION',
  services: 'SERVICE',
  testimonials: 'TESTIMONIAL',
  events: 'EVENT',
  awards: 'AWARD',
  clients: 'CLIENT',
  stats: 'STAT',
  process: 'STEP',
  downloads: 'LINK',
  team: 'PERSON',
};

/** Plain names for page-part text fields, used in the "examples left" list. */
export const partFieldNames: Record<string, string> = {
  eyebrow: 'small line above your name',
  headline: 'main heading',
  subheadline: 'short introduction',
  heading: 'heading',
  body: 'text',
  intro: 'introduction',
  url: 'song or video link',
  oneLiner: 'one-line bio',
  short: 'short bio',
  long: 'long bio',
};
