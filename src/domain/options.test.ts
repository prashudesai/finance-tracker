import { describe, expect, test } from 'vitest';
import { addFamilyName } from './options';

describe('addFamilyName', () => {
  test('adds a name to an existing list', () => {
    expect(addFamilyName(['Asha'], ' Priya ', 'Asha Rao')).toEqual(['Asha', 'Priya']);
  });

  test('the first name brings the account holder, so there is a choice', () => {
    expect(addFamilyName([], 'Priya', 'Asha Rao')).toEqual(['Asha', 'Priya']);
  });

  test('never uses an email address as a name', () => {
    expect(addFamilyName([], 'Priya', 'asha@example.test')).toEqual(['Priya']);
  });

  test('keeps the list as it is for a name already there, or a blank', () => {
    expect(addFamilyName(['Asha'], 'ASHA', 'Asha Rao')).toEqual(['Asha']);
    expect(addFamilyName([], 'Asha', 'Asha Rao')).toEqual(['Asha']);
    expect(addFamilyName(['Asha'], '  ', 'Asha Rao')).toEqual(['Asha']);
  });
});
