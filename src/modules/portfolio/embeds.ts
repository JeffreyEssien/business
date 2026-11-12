/**
 * "Add a song or video": an owner pastes a share link and it becomes a player. Only the
 * providers below are recognised; anything else is refused before saving, and the
 * database repeats the host allow-list. The page never accepts embed code or HTML.
 */

export type EmbedProvider =
  'youtube' | 'vimeo' | 'spotify' | 'apple-music' | 'soundcloud' | 'audiomack' | 'boomplay';

export type Embed = {
  provider: EmbedProvider;
  /** Provider name as visitors know it. */
  label: string;
  /** Player address for the iframe, or null when the provider is shown as a link only. */
  src: string | null;
  /** The owner's original link, used for the "Open in …" fallback. */
  href: string;
  kind: 'video' | 'audio';
};

/** Hosts accepted for embeds. Mirrors `private.portfolio_embed_hosts()` in the database. */
export const embedHosts = [
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'youtu.be',
  'vimeo.com',
  'www.vimeo.com',
  'open.spotify.com',
  'music.apple.com',
  'soundcloud.com',
  'www.soundcloud.com',
  'm.soundcloud.com',
  'audiomack.com',
  'www.audiomack.com',
  'boomplay.com',
  'www.boomplay.com',
] as const;

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function parse(raw: string) {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    url.protocol = 'https:';
    if (url.username || url.password || url.port) return null;
    if (!(embedHosts as readonly string[]).includes(url.hostname.toLowerCase())) return null;
    return url;
  } catch {
    return null;
  }
}

/** Normalises a pasted link to https, or '' when it is not from an accepted provider. */
export function normalizeEmbedUrl(raw: string) {
  return parse(raw)?.toString() ?? '';
}

export function embedFromUrl(raw: string): Embed | null {
  const url = parse(raw);
  if (!url) return null;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, '');
  const parts = url.pathname.split('/').filter(Boolean);
  const href = url.toString();

  if (host === 'youtube.com' || host === 'youtu.be') {
    const id =
      host === 'youtu.be'
        ? parts[0]
        : parts[0] === 'watch'
          ? url.searchParams.get('v')
          : ['shorts', 'embed', 'live'].includes(parts[0] ?? '')
            ? parts[1]
            : null;
    if (!id || !YOUTUBE_ID.test(id)) return null;
    // The no-cookie host avoids tracking cookies until the visitor presses play.
    return {
      provider: 'youtube',
      label: 'YouTube',
      src: `https://www.youtube-nocookie.com/embed/${id}`,
      href,
      kind: 'video',
    };
  }
  if (host === 'vimeo.com') {
    const id = parts.find((part) => /^\d{5,12}$/.test(part));
    if (!id) return null;
    return {
      provider: 'vimeo',
      label: 'Vimeo',
      src: `https://player.vimeo.com/video/${id}?dnt=1`,
      href,
      kind: 'video',
    };
  }
  if (host === 'open.spotify.com') {
    const rest = parts[0]?.startsWith('intl-') ? parts.slice(1) : parts;
    const [type, id] = rest;
    if (
      !['track', 'album', 'playlist', 'episode', 'show', 'artist'].includes(type ?? '') ||
      !/^[A-Za-z0-9]{10,40}$/.test(id ?? '')
    )
      return null;
    return {
      provider: 'spotify',
      label: 'Spotify',
      src: `https://open.spotify.com/embed/${type}/${id}`,
      href,
      kind: 'audio',
    };
  }
  if (host === 'music.apple.com') {
    if (parts.length < 3) return null;
    return {
      provider: 'apple-music',
      label: 'Apple Music',
      src: `https://embed.music.apple.com${url.pathname}${url.search}`,
      href,
      kind: 'audio',
    };
  }
  if (host === 'soundcloud.com') {
    if (parts.length < 2) return null;
    const track = `https://soundcloud.com/${parts.map(encodeURIComponent).join('/')}`;
    return {
      provider: 'soundcloud',
      label: 'SoundCloud',
      src: `https://w.soundcloud.com/player/?url=${encodeURIComponent(track)}&visual=false`,
      href,
      kind: 'audio',
    };
  }
  if (host === 'audiomack.com') {
    const [artist, kind, slug] = parts;
    if (!artist || !['song', 'album', 'playlist'].includes(kind ?? '') || !slug) return null;
    return {
      provider: 'audiomack',
      label: 'Audiomack',
      src: `https://audiomack.com/embed/${kind}/${encodeURIComponent(artist)}/${encodeURIComponent(slug)}`,
      href,
      kind: 'audio',
    };
  }
  // Boomplay has no documented public embed address, so it is shown as a clear link.
  return { provider: 'boomplay', label: 'Boomplay', src: null, href, kind: 'audio' };
}
