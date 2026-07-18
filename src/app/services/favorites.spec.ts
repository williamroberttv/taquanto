import { PriceRecord } from './taquanto-api';
import { Favorites } from './favorites';

const firstRecord: PriceRecord = {
  description: 'Arroz branco 1kg',
  gtin: '7891234567890',
  source_product_code: '42',
  declared_value_cents: 629,
  sale_value_cents: 599,
  unit: 'UN',
  sold_at: '2026-07-17T12:00:00Z',
  store: { name: 'Mercado Centro', cnpj: '00000000000000' },
  location: {
    latitude: -9.6658,
    longitude: -35.735,
    address: 'Rua do Comércio, 10',
    district: 'Centro',
    city: 'Maceió',
    zip_code: '57000-000',
    source: 'sefaz',
  },
};

const secondRecord: PriceRecord = {
  ...firstRecord,
  description: 'Feijão carioca 1kg',
  gtin: '7891234567891',
  source_product_code: '43',
};

describe('Favorites', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('restores favorite sale records with the most recently saved first', () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);
    const favorites = new Favorites();

    expect(favorites.toggle(firstRecord)).toBe(true);
    expect(favorites.toggle(secondRecord)).toBe(true);

    expect(new Favorites().records().map(({ record }) => record.description)).toEqual([
      'Feijão carioca 1kg',
      'Arroz branco 1kg',
    ]);
  });

  it('removes an identical sale record instead of creating a duplicate', () => {
    const favorites = new Favorites();
    const sameRecord: PriceRecord = {
      location: { ...firstRecord.location },
      store: { ...firstRecord.store },
      sold_at: firstRecord.sold_at,
      unit: firstRecord.unit,
      sale_value_cents: firstRecord.sale_value_cents,
      declared_value_cents: firstRecord.declared_value_cents,
      source_product_code: firstRecord.source_product_code,
      gtin: firstRecord.gtin,
      description: firstRecord.description,
    };

    expect(favorites.toggle(firstRecord)).toBe(true);
    expect(favorites.has(sameRecord)).toBe(true);
    expect(favorites.toggle(sameRecord)).toBe(true);
    expect(favorites.records()).toEqual([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
});
