import { describe, expect, it } from 'vitest';
import { isInternalUrl, safeUrl } from './url.js';

describe('safeUrl', () => {
  it.each([
    ['/actualites/a', '/actualites/a'],
    ['./doc.pdf', './doc.pdf'],
    ['#section', '#section'],
    ['https://univh2c.ma', 'https://univh2c.ma'],
    ['mailto:fsbm.contact@univh2c.ma', 'mailto:fsbm.contact@univh2c.ma'],
    ['tel:+212661442427', 'tel:+212661442427'],
  ])('accepte %s', (input, expected) => expect(safeUrl(input)).toBe(expected));

  it.each(['javascript:alert(1)', 'data:text/html,x', '//evil.example', '/\\evil.example', '', '   ', 42, null])(
    'rejette %s',
    (input) => expect(safeUrl(input)).toBe('#'),
  );
});

describe('isInternalUrl', () => {
  it('distingue liens internes et externes', () => {
    expect(isInternalUrl('/formation')).toBe(true);
    expect(isInternalUrl('//evil.example')).toBe(false);
    expect(isInternalUrl('https://univh2c.ma')).toBe(false);
  });
});
