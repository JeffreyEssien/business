'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { normalizeEmbedUrl } from './embeds';
import { entryCopy, isEntryType, type EntryType } from './entries';
import { requirePortfolioWorkspace } from './guards';
import {
  applyAlbum,
  applyPhoto,
  readAlbum,
  readPhoto,
  releaseReplaced,
  type PhotoSlot,
} from './photos';

export type BuilderActionState = { error: string };

function canEdit(role: string) {
  return ['TENANT_OWNER', 'TENANT_ADMIN', 'TENANT_MANAGER'].includes(role);
}

async function editableWorkspace(slug: string) {
  const workspace = await requirePortfolioWorkspace(slug);
  if (!canEdit(workspace.membership.role)) return null;
  return workspace;
}

const noPermission = { error: 'You do not have permission to change this portfolio.' };

/** Plain-language messages; owners never see database codes. */
function builderError(code?: string, message?: string): BuilderActionState {
  if (message?.includes('INVALID_LINK'))
    return {
      error:
        'One of the links is not a web address. Copy the full address from your browser and paste it again.',
    };
  if (message?.includes('INVALID_EMBED'))
    return {
      error:
        'That link is not from a site we can play here. Use a YouTube, Vimeo, Spotify, Apple Music, SoundCloud, Audiomack, or Boomplay link.',
    };
  if (message?.includes('INVALID_DATE')) return { error: 'Please check the dates and try again.' };
  if (code === '23514' || message?.includes('USAGE_LIMIT_EXCEEDED'))
    return {
      error: 'You have reached the number of entries your plan allows. Remove one to add another.',
    };
  if (code === '42501') return noPermission;
  if (code === '22023')
    return { error: 'Some details could not be saved. Please check the form and try again.' };
  return { error: 'That did not save. Please try again in a moment.' };
}

const read = (form: FormData, name: string) => String(form.get(name) ?? '').trim();

/**
 * Owners paste links in many shapes. Add the missing https://, and upgrade http://,
 * so "github.com/ada" just works. The database still rejects anything unsafe.
 */
function normalizeLink(value: string) {
  if (!value) return '';
  if (/^https:\/\//i.test(value)) return value;
  if (/^http:\/\//i.test(value)) return value.replace(/^http:\/\//i, 'https://');
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return value; // other schemes: let the database refuse
  return `https://${value}`;
}

/**
 * <input type="month"> gives YYYY-MM (stored as the first of the month); events use
 * <input type="date">, which already gives YYYY-MM-DD.
 */
function monthToDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return /^\d{4}-\d{2}$/.test(value) ? `${value}-01` : '';
}

function splitTags(value: string) {
  const seen = new Set<string>();
  return value
    .split(/[,\n]/)
    .map((tag) => tag.trim().slice(0, 40))
    .filter((tag) => tag && !seen.has(tag.toLowerCase()) && seen.add(tag.toLowerCase()))
    .slice(0, 20);
}

/** The stored shape of an entry form; shared by Save and autosave so they never drift. */
function entryPayload(entryType: EntryType, form: FormData) {
  const isCurrent = form.get('isCurrent') === 'on';
  return {
    itemType: entryType,
    title: read(form, 'title'),
    subtitle: read(form, 'subtitle'),
    summary: read(form, 'summary'),
    role: read(form, 'role'),
    outcome: read(form, 'outcome'),
    linkUrl: normalizeLink(read(form, 'linkUrl')),
    sourceUrl: normalizeLink(read(form, 'sourceUrl')),
    startsOn: monthToDate(read(form, 'startsOn')),
    endsOn: isCurrent ? '' : monthToDate(read(form, 'endsOn')),
    isCurrent,
    tags: splitTags(read(form, 'tags')),
    status: form.get('visible') === 'on' ? 'ACTIVE' : 'HIDDEN',
  };
}

function entriesPath(slug: string, type: EntryType, notice: string) {
  return `/t/${slug}/portfolio?show=${entryCopy[type].param}&notice=${notice}`;
}

function refresh(slug: string) {
  revalidatePath(`/t/${slug}`, 'layout');
}

export async function saveEntry(
  slug: string,
  entryId: string | null,
  entryType: string,
  _state: BuilderActionState,
  form: FormData,
): Promise<BuilderActionState> {
  if (!isEntryType(entryType)) return { error: 'Choose what kind of entry this is.' };
  const workspace = await editableWorkspace(slug);
  if (!workspace) return noPermission;
  const title = read(form, 'title');
  if (!title) return { error: `Give this ${entryCopy[entryType].singular} a name first.` };
  // Only entry kinds with a photo field (projects, people) carry one, and only projects
  // have an album; check both before saving anything.
  const photo = entryCopy[entryType].photo ? readPhoto(form, 'cover') : null;
  if (photo && 'error' in photo) return photo;
  const album = entryType === 'PROJECT' ? readAlbum(form) : null;
  if (album && 'error' in album) return album;
  const { data: savedId, error } = await workspace.supabase.rpc('save_portfolio_item', {
    target_tenant: workspace.tenant.id,
    target_item: entryId,
    payload: entryPayload(entryType, form),
  });
  if (error) return builderError(error.code, error.message);
  if (typeof savedId === 'string') {
    // Cover and album uploads run together inside this one authorized operation.
    const problems = await Promise.all([
      photo ? applyPhoto(workspace.supabase, workspace.tenant.id, 'cover', savedId, photo) : null,
      album ? applyAlbum(workspace.supabase, workspace.tenant.id, savedId, album) : null,
    ]);
    const problem = problems.find(Boolean);
    if (problem) {
      refresh(slug);
      return { error: `Your words were saved. ${problem}` };
    }
  }
  refresh(slug);
  redirect(entriesPath(slug, entryType, 'saved'));
}

export async function deleteEntry(slug: string, entryId: string, entryType: EntryType) {
  const workspace = await editableWorkspace(slug);
  if (!workspace) redirect(entriesPath(slug, entryType, 'not-allowed'));
  const { data: released, error } = await workspace.supabase.rpc('delete_portfolio_item', {
    target_tenant: workspace.tenant.id,
    target_item: entryId,
  });
  if (!error) await releaseReplaced(released);
  refresh(slug);
  redirect(entriesPath(slug, entryType, error ? 'not-deleted' : 'deleted'));
}

export async function moveEntries(slug: string, entryType: EntryType, orderedIds: string[]) {
  const workspace = await editableWorkspace(slug);
  if (!workspace) redirect(entriesPath(slug, entryType, 'not-allowed'));
  const { error } = await workspace.supabase.rpc('reorder_portfolio_items', {
    target_tenant: workspace.tenant.id,
    target_type: entryType,
    item_ids: orderedIds,
  });
  refresh(slug);
  redirect(entriesPath(slug, entryType, error ? 'not-moved' : 'moved'));
}

/** Builds the stored content for one page part from its form, by part type. */
function partPayload(type: string, form: FormData) {
  const target = read(form, 'ctaTarget');
  const primaryCta = {
    label: read(form, 'ctaLabel'),
    href: target === 'website' ? normalizeLink(read(form, 'ctaUrl')) : target,
  };
  if (type === 'hero') {
    return {
      eyebrow: read(form, 'eyebrow'),
      headline: read(form, 'headline'),
      subheadline: read(form, 'subheadline'),
      primaryCta,
    };
  }
  if (type === 'about' || type === 'contact') {
    return { heading: read(form, 'heading'), body: read(form, 'body') };
  }
  if (type === 'cta') {
    return { heading: read(form, 'heading'), body: read(form, 'body'), primaryCta };
  }
  if (type === 'embed') {
    // Tidy known players (e.g. drop tracking parameters). Anything else is sent as typed
    // so the database refuses it with INVALID_EMBED instead of it silently vanishing.
    const raw = read(form, 'url');
    return {
      heading: read(form, 'heading'),
      intro: read(form, 'intro'),
      url: raw ? normalizeEmbedUrl(raw) || normalizeLink(raw) : '',
    };
  }
  if (type === 'bios') {
    return {
      heading: read(form, 'heading'),
      oneLiner: read(form, 'oneLiner'),
      short: read(form, 'short'),
      long: read(form, 'long'),
    };
  }
  return { heading: read(form, 'heading'), intro: read(form, 'intro') };
}

export async function savePart(
  slug: string,
  partKey: string,
  partType: string,
  _state: BuilderActionState,
  form: FormData,
): Promise<BuilderActionState> {
  const workspace = await editableWorkspace(slug);
  if (!workspace) return noPermission;
  if (partType === 'hero' && !read(form, 'headline')) {
    return { error: 'Add your name or a main heading first.' };
  }
  // The opening part and About parts can carry a photo; check it before saving anything.
  const photoSlot: PhotoSlot | null =
    partType === 'hero' ? 'hero' : partType === 'about' ? 'about' : null;
  const photo = photoSlot ? readPhoto(form, 'photo') : null;
  if (photo && 'error' in photo) return photo;
  const { error } = await workspace.supabase.rpc('save_portfolio_section', {
    target_tenant: workspace.tenant.id,
    target_key: partKey,
    payload: partPayload(partType, form),
    section_variant: read(form, 'look') || null,
    section_visible: form.get('visible') === 'on',
  });
  if (error) return builderError(error.code, error.message);
  if (photo && photoSlot) {
    const photoError = await applyPhoto(
      workspace.supabase,
      workspace.tenant.id,
      photoSlot,
      partKey,
      photo,
    );
    if (photoError) {
      refresh(slug);
      return { error: `Your words were saved. ${photoError}` };
    }
  }
  refresh(slug);
  redirect(`/t/${slug}/design?notice=part-saved`);
}

export async function saveLook(
  slug: string,
  _state: BuilderActionState,
  form: FormData,
): Promise<BuilderActionState> {
  const workspace = await editableWorkspace(slug);
  if (!workspace) return noPermission;
  let palette: unknown;
  try {
    palette = JSON.parse(read(form, 'palette'));
  } catch {
    return { error: 'Choose your colours again, then press Save.' };
  }
  const { error } = await workspace.supabase.rpc('save_portfolio_look', {
    target_tenant: workspace.tenant.id,
    target_style: read(form, 'style'),
    palette,
  });
  if (error?.message.includes('LOW_CONTRAST')) {
    return { error: 'Text would be hard to read with these colours. Try a ready-made set.' };
  }
  if (error) return builderError(error.code, error.message);
  refresh(slug);
  redirect(`/t/${slug}/design?notice=look-saved`);
}

export async function completeSetup(
  slug: string,
  _state: BuilderActionState,
  form: FormData,
): Promise<BuilderActionState> {
  const workspace = await editableWorkspace(slug);
  if (!workspace) return noPermission;
  if (!read(form, 'name')) return { error: 'Add your name, or your studio’s name.' };
  let palette: unknown;
  try {
    palette = JSON.parse(read(form, 'palette'));
  } catch {
    return { error: 'Pick a look again, then press Create my page.' };
  }
  const { error } = await workspace.supabase.rpc('complete_portfolio_setup', {
    target_tenant: workspace.tenant.id,
    payload: {
      name: read(form, 'name'),
      role: read(form, 'role'),
      email: read(form, 'email'),
      whatsapp: read(form, 'whatsapp'),
      style: read(form, 'style'),
      palette,
    },
  });
  if (error?.message.includes('INVALID_EMAIL')) {
    return { error: 'That email address does not look right. Check it and try again.' };
  }
  if (error?.message.includes('INVALID_PHONE')) {
    return { error: 'Add the WhatsApp number with its country code, e.g. +234 801 234 5678.' };
  }
  if (error) return builderError(error.code, error.message);
  refresh(slug);
  redirect(`/t/${slug}/design?notice=setup-done`);
}

export async function skipSetup(slug: string) {
  const workspace = await editableWorkspace(slug);
  if (workspace) {
    await workspace.supabase.rpc('skip_portfolio_setup', { target_tenant: workspace.tenant.id });
  }
  refresh(slug);
  redirect(`/t/${slug}`);
}

export async function addPart(slug: string, partType: string) {
  const workspace = await editableWorkspace(slug);
  if (!workspace) redirect(`/t/${slug}/design?notice=not-allowed`);
  const { data, error } = await workspace.supabase.rpc('add_portfolio_section', {
    target_tenant: workspace.tenant.id,
    section_type: partType,
  });
  refresh(slug);
  if (error || typeof data !== 'string') redirect(`/t/${slug}/design?notice=not-added`);
  redirect(`/t/${slug}/design/parts/${data}?notice=added`);
}

export async function removePart(slug: string, partKey: string) {
  const workspace = await editableWorkspace(slug);
  if (!workspace) redirect(`/t/${slug}/design?notice=not-allowed`);
  const { data: released, error } = await workspace.supabase.rpc('remove_portfolio_section', {
    target_tenant: workspace.tenant.id,
    target_key: partKey,
  });
  if (!error) await releaseReplaced(released);
  refresh(slug);
  redirect(`/t/${slug}/design?notice=${error ? 'not-removed' : 'part-removed'}`);
}

export type AutosaveResult = { ok: boolean; error?: string };

/**
 * Autosave while typing: text and choices only (photos wait for Save, because uploads
 * take time and use data). Never redirects. Incomplete forms are skipped quietly.
 */
export async function autosaveEntry(
  slug: string,
  entryId: string,
  entryType: string,
  form: FormData,
): Promise<AutosaveResult> {
  if (!isEntryType(entryType)) return { ok: false };
  const workspace = await editableWorkspace(slug);
  if (!workspace) return { ok: false, error: noPermission.error };
  if (!read(form, 'title')) return { ok: false, error: 'Add a name to keep saving.' };
  const { error } = await workspace.supabase.rpc('save_portfolio_item', {
    target_tenant: workspace.tenant.id,
    target_item: entryId,
    payload: entryPayload(entryType, form),
  });
  if (error) return { ok: false, error: builderError(error.code, error.message).error };
  refresh(slug);
  return { ok: true };
}

export async function autosavePart(
  slug: string,
  partKey: string,
  partType: string,
  form: FormData,
): Promise<AutosaveResult> {
  const workspace = await editableWorkspace(slug);
  if (!workspace) return { ok: false, error: noPermission.error };
  if (partType === 'hero' && !read(form, 'headline')) {
    return { ok: false, error: 'Add your name or a main heading to keep saving.' };
  }
  const { error } = await workspace.supabase.rpc('save_portfolio_section', {
    target_tenant: workspace.tenant.id,
    target_key: partKey,
    payload: partPayload(partType, form),
    section_variant: read(form, 'look') || null,
    section_visible: form.get('visible') === 'on',
  });
  if (error) return { ok: false, error: builderError(error.code, error.message).error };
  refresh(slug);
  return { ok: true };
}

/** Reverts the last burst of changes to one part or entry, then returns to its editor. */
export async function undoChange(slug: string, kind: 'part' | 'entry', ref: string) {
  const back =
    kind === 'part'
      ? `/t/${slug}/design/parts/${encodeURIComponent(ref)}`
      : `/t/${slug}/portfolio/${encodeURIComponent(ref)}`;
  const workspace = await editableWorkspace(slug);
  if (!workspace) redirect(`${back}?notice=not-allowed`);
  const { data, error } = await workspace.supabase.rpc('undo_portfolio_change', {
    target_tenant: workspace.tenant.id,
    kind,
    ref,
  });
  refresh(slug);
  redirect(`${back}?notice=${error ? 'not-undone' : data ? 'undone' : 'nothing-to-undo'}`);
}

/**
 * Takes the live portfolio offline. Visitors see the "not live yet" page; the draft is
 * untouched, and "Make my portfolio live" publishes it again. Photos only the live page
 * was holding on to are released and their Cloudinary files deleted.
 */
export async function takePortfolioOffline(slug: string) {
  const workspace = await editableWorkspace(slug);
  if (!workspace) redirect(`/t/${slug}/design?notice=not-allowed`);
  const { data, error } = await workspace.supabase.rpc('take_portfolio_offline', {
    target_tenant: workspace.tenant.id,
  });
  if (!error) await releaseReplaced(data);
  refresh(slug);
  revalidatePath(`/store/${slug}`);
  redirect(`/t/${slug}/design?notice=${error ? 'not-offline' : 'offline'}`);
}
