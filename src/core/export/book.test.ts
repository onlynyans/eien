import { describe, expect, it } from 'vitest';
import { languageTag, pageSizeOf, utcSeconds, uuidOf } from './book';

describe('languageTag', () => {
  it('keeps a tag, and is English for anything else', () => {
    expect(languageTag('pt-BR')).toBe('pt-BR');
    expect(languageTag('zh-Hant-TW')).toBe('zh-Hant-TW');
    for (const bad of ['', 'e', 'en_US', 'en-', '"><x', 'english-language-name-way-too-long']) {
      expect(languageTag(bad), bad).toBe(
        bad === 'english-language-name-way-too-long' ? 'en' : 'en',
      );
    }
  });
});

describe('pageSizeOf', () => {
  it('is letter where the region uses it, A4 elsewhere and with no region', () => {
    expect(pageSizeOf('en-US')).toBe('letter');
    expect(pageSizeOf('es-MX')).toBe('letter');
    expect(pageSizeOf('fr-ca')).toBe('letter');
    expect(pageSizeOf('zh-Hant-TW')).toBe('a4');
    expect(pageSizeOf('en-GB')).toBe('a4');
    expect(pageSizeOf('en')).toBe('a4');
    expect(pageSizeOf('nonsense!')).toBe('a4');
  });
});

describe('uuidOf', () => {
  it('is a UUID, the same for the same key', () => {
    const id = uuidOf('Vault/Book');
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u);
    expect(uuidOf('Vault/Book')).toBe(id);
    expect(uuidOf('Vault/Book2')).not.toBe(id);
    expect(uuidOf('')).toMatch(/^[0-9a-f-]{36}$/u);
  });
});

describe('utcSeconds', () => {
  it('is UTC to the second; an invalid date is 1970’s start', () => {
    expect(utcSeconds(new Date(Date.UTC(2026, 9, 20, 1, 2, 3, 999)))).toBe('2026-10-20T01:02:03Z');
    expect(utcSeconds(new Date(Number.NaN))).toBe('1970-01-01T00:00:00Z');
  });
});
