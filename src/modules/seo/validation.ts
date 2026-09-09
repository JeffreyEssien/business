function text(form: FormData, key: string, maximum: number) {
  const value = String(form.get(key) ?? '').trim();
  return value.length <= maximum ? value : null;
}

export function validateSeoImage(form: FormData) {
  const value = form.get('socialImage');
  if (!(value instanceof File) || value.size === 0) return null;
  if (
    !['image/jpeg', 'image/png', 'image/webp'].includes(value.type) ||
    value.size > 5 * 1024 * 1024
  ) {
    throw new Error('Sharing images must be JPG, PNG, or WebP files up to 5 MB.');
  }
  return value;
}

export function validateGlobalSeo(form: FormData) {
  const title = text(form, 'title', 60);
  const description = text(form, 'description', 160);
  const socialAccount = text(form, 'socialAccount', 50);
  if (!title || description === null || socialAccount === null) {
    return {
      input: null,
      error: 'Keep the search title within 60 characters and the description within 160.',
    };
  }
  return {
    error: null,
    input: {
      title,
      description,
      socialAccount,
      allowSearchListing: form.get('allowSearchListing') === 'on',
      allowSearchLinks: form.get('allowSearchLinks') === 'on',
    },
  };
}

export function validateEntitySeo(form: FormData) {
  const title = text(form, 'title', 60);
  const description = text(form, 'description', 160);
  const canonicalUrl = text(form, 'canonicalUrl', 2048);
  const socialTitle = text(form, 'socialTitle', 60);
  const socialDescription = text(form, 'socialDescription', 160);
  if ([title, description, canonicalUrl, socialTitle, socialDescription].includes(null))
    return { error: 'One or more search fields are too long.', input: null };
  if (canonicalUrl) {
    try {
      const url = new URL(canonicalUrl);
      if (url.protocol !== 'https:') throw new Error('HTTPS required');
    } catch {
      return {
        error: 'The preferred page address must be a complete HTTPS address.',
        input: null,
      };
    }
  }
  return {
    error: null,
    input: {
      title: title ?? '',
      description: description ?? '',
      canonicalUrl: canonicalUrl ?? '',
      socialTitle: socialTitle ?? '',
      socialDescription: socialDescription ?? '',
      allowSearchListing: form.get('allowSearchListing') === 'on',
      allowSearchLinks: form.get('allowSearchLinks') === 'on',
    },
  };
}
