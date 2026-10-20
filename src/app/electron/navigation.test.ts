import { describe, expect, it } from 'vitest';
import { isAppUrl, isExternalLink } from './navigation';

describe('isAppUrl with a dev server', () => {
  const app = 'http://localhost:5173';

  it.each([
    'http://localhost:5173',
    'http://localhost:5173/',
    'http://localhost:5173/index.html?x=1#y',
  ])('allows the app itself: %s', (url) => {
    expect(isAppUrl(url, app)).toBe(true);
  });

  it.each([
    ['another port', 'http://localhost:5174/'],
    ['another scheme', 'https://localhost:5173/'],
    ['a look-alike host', 'http://localhost:5173.evil.com/'],
    ['credentials hiding the host', 'http://localhost:5173@evil.com/'],
    ['a web page', 'https://example.com/'],
    ['javascript:', 'javascript:alert(1)'],
    ['data:', 'data:text/html,<script>alert(1)</script>'],
    ['file:', 'file:///etc/passwd'],
    ['not a URL', 'not a url'],
    ['empty', ''],
  ])('refuses %s', (_, url) => {
    expect(isAppUrl(url, app)).toBe(false);
  });
});

describe('isAppUrl with the built app on disk', () => {
  const app = 'file:///Applications/Eien.app/out/renderer/index.html';

  it('allows the page, with a query or fragment', () => {
    expect(isAppUrl(app, app)).toBe(true);
    expect(isAppUrl(`${app}?note=1#top`, app)).toBe(true);
  });

  it.each([
    ['another file', 'file:///etc/passwd'],
    ['a sibling file', 'file:///Applications/Eien.app/out/renderer/other.html'],
    ['a path that climbs out of it', `${app}/../../../etc/passwd`],
    [
      'the same path on a web host',
      'http://evil.com/Applications/Eien.app/out/renderer/index.html',
    ],
  ])('refuses %s', (_, url) => {
    expect(isAppUrl(url, app)).toBe(false);
  });

  it('refuses everything when the app URL itself is malformed', () => {
    expect(isAppUrl(app, 'not a url')).toBe(false);
  });
});

describe('isExternalLink', () => {
  it.each([
    'https://archiveofourown.org/works/1',
    'http://example.com',
    'HTTPS://EXAMPLE.COM',
    'mailto:me@example.com',
  ])('opens %s in the system', (url) => {
    expect(isExternalLink(url)).toBe(true);
  });

  it.each([
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    'file:///etc/passwd',
    'data:text/html,hi',
    'smb://server/share',
    'vbscript:msgbox',
    '//example.com',
    'example.com',
    '',
  ])('never hands %s to the system', (url) => {
    expect(isExternalLink(url)).toBe(false);
  });
});
