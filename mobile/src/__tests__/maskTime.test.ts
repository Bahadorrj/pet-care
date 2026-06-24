import { maskTime } from '../screens/tasks/TaskFormScreen';

describe('maskTime', () => {
  it('passes a single digit through untouched', () => {
    expect(maskTime('', '8')).toBe('8');
  });

  it('inserts the colon once both hour digits are typed', () => {
    expect(maskTime('0', '08')).toBe('08:');
  });

  it('keeps building the minutes after the colon', () => {
    expect(maskTime('08:', '08:5')).toBe('08:5');
    expect(maskTime('08:5', '08:50')).toBe('08:50');
  });

  it('lets a backspace step back past the auto-colon', () => {
    expect(maskTime('08:', '08')).toBe('08');
  });

  it('strips non-digits and caps at four digits', () => {
    expect(maskTime('', '08:5099')).toBe('08:50');
  });
});
