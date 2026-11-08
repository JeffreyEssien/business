/**
 * Plain-language wording and field rules for portfolio entries and page parts.
 * This is the single source for everything the owner reads in the builder
 * (docs/plans/portfolio-templates.md §5). The database independently validates values.
 */

export const entryTypes = ['PROJECT', 'EXPERIENCE', 'EDUCATION', 'SKILL'] as const;
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
  // Photo layouts arrive with photo uploads; until then only the text layout is offered.
  about: [{ value: 'text', label: 'Text only' }],
  projects: [
    { value: 'grid', label: 'Cards in a grid' },
    { value: 'featured', label: 'Large, one after another' },
    { value: 'masonry', label: 'Picture wall' },
    { value: 'list', label: 'Simple list' },
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
};

/** Parts an owner can add from the "Add a part" menu. */
export const addablePartTypes = [
  'about',
  'projects',
  'experience',
  'education',
  'skills',
  'contact',
] as const;

/** Which entry type fills an entry-backed part. */
export const partEntryType: Record<string, EntryType> = {
  projects: 'PROJECT',
  experience: 'EXPERIENCE',
  education: 'EDUCATION',
  skills: 'SKILL',
};

/** Plain names for page-part text fields, used in the "examples left" list. */
export const partFieldNames: Record<string, string> = {
  eyebrow: 'small line above your name',
  headline: 'main heading',
  subheadline: 'short introduction',
  heading: 'heading',
  body: 'text',
  intro: 'introduction',
};
