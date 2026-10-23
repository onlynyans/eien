import { describe, expect, it } from 'vitest';
import { NAMED_ENTITIES } from './entities';
import { decodeEntities } from './html';

describe('NAMED_ENTITIES', () => {
  it('holds HTML 4’s 252 names and &apos;, each at its character', () => {
    expect(NAMED_ENTITIES.size).toBe(253);
    const at = (name: string) => NAMED_ENTITIES.get(name)?.codePointAt(0);
    expect([at('nbsp'), at('yuml'), at('Rho'), at('Sigma'), at('Omega')]).toEqual([
      160, 255, 929, 931, 937,
    ]);
    expect([at('alpha'), at('sigmaf'), at('omega'), at('hArr'), at('rlm'), at('rfloor')]).toEqual([
      945, 962, 969, 8660, 8207, 8971,
    ]);
    expect([at('euro'), at('apos'), at('diams'), at('fnof')]).toEqual([8364, 39, 9830, 402]);
  });

  it('is what decodeEntities reads; a name not in it stays as written, case and all', () => {
    expect(decodeEntities('5&euro; caf&eacute; &Eacute; &bogus; &EUro;')).toBe(
      '5€ café É &bogus; &EUro;',
    );
  });
});
