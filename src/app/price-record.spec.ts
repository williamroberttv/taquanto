import { formatAddress, formatSaleTime, formatTitle, recordCoordinates } from './price-record';
import { PriceRecord } from './services/taquanto-api';

const record = { sold_at: '2026-07-31T12:00:00Z' } as PriceRecord;

describe('price record formatting', () => {
  it('formats compact sale metadata', () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-31T14:00:00Z').getTime());

    expect(formatAddress('RUA DO COMÉRCIO, 10 - MACEIÓ - CEP: 57000-000')).toBe(
      'Rua Do Comércio, 10',
    );
    expect(formatTitle('CAFÉ MOÍDO EXTRA-VIRGEM 1KG')).toBe('Café Moído Extra-Virgem 1kg');
    expect(formatSaleTime(record)).toBe('Há 2 horas');
  });

  it('rejects missing and zeroed coordinates', () => {
    const withCoordinates = (latitude: number | null, longitude: number | null) =>
      ({ location: { latitude, longitude } }) as PriceRecord;

    expect(recordCoordinates(withCoordinates(null, null))).toBeNull();
    expect(recordCoordinates(withCoordinates(0, 0))).toBeNull();
    expect(recordCoordinates(withCoordinates(-9.665, -35.735))).toEqual([-9.665, -35.735]);
  });
});
