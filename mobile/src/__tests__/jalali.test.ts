import { daysInJalaliMonth, jalaliParts, formatJalaliParts } from '../lib/jalali';

describe('daysInJalaliMonth', () => {
  test('months 1–6 have 31 days', () => {
    for (let m = 1; m <= 6; m++) expect(daysInJalaliMonth(1404, m)).toBe(31);
  });
  test('months 7–11 have 30 days', () => {
    for (let m = 7; m <= 11; m++) expect(daysInJalaliMonth(1404, m)).toBe(30);
  });
  test('Esfand is 30 in a leap year, 29 otherwise', () => {
    expect(daysInJalaliMonth(1403, 12)).toBe(30); // leap
    expect(daysInJalaliMonth(1404, 12)).toBe(29); // non-leap
  });
});

describe('jalaliParts / formatJalaliParts', () => {
  test('round-trips a valid string', () => {
    expect(jalaliParts('1405/04/10')).toEqual({ y: 1405, m: 4, d: 10 });
    expect(formatJalaliParts(1405, 4, 10)).toBe('1405/04/10');
  });
  test('rejects malformed input', () => {
    expect(jalaliParts('not-a-date')).toBeNull();
    expect(jalaliParts('')).toBeNull();
  });
});
