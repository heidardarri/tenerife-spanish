import { describe, expect, it } from 'vitest';
import { containsAny, grade, normalize, similarity } from './text';

describe('text matching', () => {
  it('normalises accents, punctuation and case', () => {
    expect(normalize('¿Dónde está el baño?')).toBe('donde esta el bano');
    expect(normalize('  Mañana   voy a la playa. ')).toBe('manana voy a la playa');
  });

  it('accepts accent-free and slightly misheard answers as correct', () => {
    expect(grade('donde esta el bano', '¿Dónde está el baño?').grade).toBe('correct');
    expect(grade('Quiero un cafe con leche por favor', 'Quiero un café con leche, por favor.').grade).toBe('correct');
    expect(grade('me gustaria un cafe', 'Me gustaría un café.').grade).toBe('correct');
  });

  it('marks partial answers close and unrelated answers wrong', () => {
    expect(grade('la cuenta', 'La cuenta, por favor.').grade).toBe('close');
    expect(grade('hola buenos dias', 'La cuenta, por favor.').grade).toBe('wrong');
    expect(similarity('', 'algo')).toBe(0);
  });

  it('finds keywords in spoken answers', () => {
    expect(containsAny('Me llamo Anna y soy de Islandia', ['me llamo', 'soy'])).toBe(true);
    expect(containsAny('Hola', ['me llamo'])).toBe(false);
    expect(containsAny('¿Qué me recomiendas?', ['recomiendas'])).toBe(true);
  });
});
