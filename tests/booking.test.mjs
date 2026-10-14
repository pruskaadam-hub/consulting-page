import test from 'node:test';
import assert from 'node:assert/strict';
import { calendlyUrl, calendlyEmbedUrl } from '../src/booking.mjs';

test('accepts a public Calendly event and removes tracking parameters', () => {
  assert.equal(calendlyUrl(' https://calendly.com/example/consultation?utm_source=test#booking '), 'https://calendly.com/example/consultation');
});
test('rejects invalid links, credentials and lookalike domains', () => {
  for (const value of [undefined, '', 'javascript:alert(1)', 'http://calendly.com/example', 'https://calendly.com.evil.test/example', 'https://user:secret@calendly.com/example', 'https://calendly.com:444/example', 'https://calendly.com/', 'https://calendly.com/app/scheduling/meeting_types/user/me']) {
    assert.equal(calendlyUrl(value), null);
    assert.equal(calendlyEmbedUrl(value), null);
  }
});
test('creates an embed URL without disabling Calendly privacy controls', () => {
  const url = new URL(calendlyEmbedUrl('https://calendly.com/example/consultation', 'example.test'));
  assert.equal(url.hostname, 'calendly.com');
  assert.equal(url.pathname, '/example/consultation');
  assert.equal(url.searchParams.get('hide_gdpr_banner'), '0');
  assert.equal(url.searchParams.get('embed_type'), 'Inline');
  assert.equal(url.searchParams.get('embed_domain'), 'example.test');
});
