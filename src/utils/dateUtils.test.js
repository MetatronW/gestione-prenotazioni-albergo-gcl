import { describe, it, expect } from 'vitest';
import {
  DEMO_TODAY,
  addDays,
  diffDays,
  formatRange,
  formatShortDate,
  getDayNumber,
  getToday,
  getWeekdayLabel,
  getWindowDays,
  isValidISODate,
  isWeekend,
  toISODate,
} from './dateUtils.js';

describe('addDays', () => {
  it('somma giorni dentro il mese', () => {
    expect(addDays('2026-10-05', 3)).toBe('2026-10-08');
  });
  it('passa al mese e all’anno successivi', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
  });
  it('sottrae con numeri negativi', () => {
    expect(addDays('2026-10-05', -5)).toBe('2026-09-30');
  });
  it('gestisce l’anno bisestile', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2027-02-28', 1)).toBe('2027-03-01');
  });
});

describe('diffDays', () => {
  it('conta i giorni tra due date', () => {
    expect(diffDays('2026-10-05', '2026-10-08')).toBe(3);
    expect(diffDays('2026-10-08', '2026-10-05')).toBe(-3);
    expect(diffDays('2026-10-05', '2026-10-05')).toBe(0);
  });
  it('non è influenzata dal cambio dell’ora legale', () => {
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
  });
});

describe('isValidISODate', () => {
  it('accetta date reali', () => {
    expect(isValidISODate('2026-10-05')).toBe(true);
    expect(isValidISODate('2028-02-29')).toBe(true);
  });
  it('rifiuta date inesistenti o in formato sbagliato', () => {
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2027-02-29')).toBe(false);
    expect(isValidISODate('2026-13-01')).toBe(false);
    expect(isValidISODate('2026-1-5')).toBe(false);
    expect(isValidISODate('05/10/2026')).toBe(false);
    expect(isValidISODate('')).toBe(false);
    expect(isValidISODate(null)).toBe(false);
    expect(isValidISODate(20261005)).toBe(false);
  });
});

describe('toISODate e getToday', () => {
  it('usa la data locale, non quella UTC', () => {
    expect(toISODate(new Date(2026, 9, 5, 23, 59))).toBe('2026-10-05');
    expect(toISODate(new Date(2026, 9, 5, 0, 1))).toBe('2026-10-05');
  });
  it('in demo "oggi" è sempre la data demo', () => {
    expect(getToday('demo')).toBe(DEMO_TODAY);
  });
  it('in modalità reale "oggi" è la data vera', () => {
    expect(getToday('real')).toBe(toISODate(new Date()));
  });
  it('la data demo è un lunedì di ottobre 2026', () => {
    expect(DEMO_TODAY).toBe('2026-10-05');
    expect(getWeekdayLabel(DEMO_TODAY)).toBe('Lun');
  });
});

describe('giorni della settimana e formati', () => {
  it('riconosce giorno e fine settimana', () => {
    expect(getWeekdayLabel('2026-10-10')).toBe('Sab');
    expect(getWeekdayLabel('2026-10-11')).toBe('Dom');
    expect(isWeekend('2026-10-10')).toBe(true);
    expect(isWeekend('2026-10-11')).toBe(true);
    expect(isWeekend('2026-10-09')).toBe(false);
  });
  it('estrae il numero del giorno', () => {
    expect(getDayNumber('2026-10-05')).toBe(5);
    expect(getDayNumber('2026-10-31')).toBe(31);
  });
  it('formatta data breve e intervallo', () => {
    expect(formatShortDate('2026-10-05')).toBe('5 ott');
    expect(formatShortDate('2026-12-31')).toBe('31 dic');
    expect(formatRange('2026-10-05')).toBe('5 ott – 11 ott 2026');
    expect(formatRange('2026-10-28')).toBe('28 ott – 3 nov 2026');
  });
  it('elenca i giorni della finestra', () => {
    expect(getWindowDays('2026-10-05')).toEqual([
      '2026-10-05',
      '2026-10-06',
      '2026-10-07',
      '2026-10-08',
      '2026-10-09',
      '2026-10-10',
      '2026-10-11',
    ]);
    expect(getWindowDays('2026-10-05', 3)).toHaveLength(3);
  });
});
