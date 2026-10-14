export function calendlyUrl(value) {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.hostname !== 'calendly.com' || url.port || url.username || url.password) return null;
    const parts = url.pathname.split('/').filter(Boolean);
    if (!parts.length || ['app', 'login', 'signup', 'sign-up', 'logout', 'integrations', 'pricing', 'features', 'about', 'contact', 'legal'].includes(parts[0].toLowerCase())) return null;
    url.search = '';
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

export function calendlyEmbedUrl(value, domain) {
  const clean = calendlyUrl(value);
  if (!clean) return null;
  const url = new URL(clean);
  url.searchParams.set('embed_type', 'Inline');
  if (domain) url.searchParams.set('embed_domain', domain);
  url.searchParams.set('hide_gdpr_banner', '0');
  url.searchParams.set('primary_color', '9b471e');
  return url.toString();
}
