function text(form: FormData, key: string, maximum: number) {
  const value = String(form.get(key) ?? '').trim();
  return value.length <= maximum ? value : null;
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
