import { TestBed } from '@angular/core/testing';
import type { LatLngBounds } from 'leaflet';
import { PriceRecord } from '../../../services/taquanto-api';
import { SearchResultsMap } from './search-results-map';

const record = (latitude: number, longitude: number): PriceRecord => ({
  description: 'Arroz branco 1kg',
  gtin: '7891234567890',
  source_product_code: '42',
  declared_value_cents: 0,
  sale_value_cents: 629,
  unit: 'UN',
  sold_at: '2026-07-17T12:00:00Z',
  store: { name: 'Mercado Centro', cnpj: '00000000000000' },
  location: {
    latitude,
    longitude,
    address: 'Rua do Comercio, 10',
    district: 'Centro',
    city: 'Maceio',
    zip_code: '57000-000',
    source: 'sefaz',
  },
});

describe('SearchResultsMap', () => {
  afterEach(() => vi.restoreAllMocks());

  it('fits the records once when the map first appears', async () => {
    await TestBed.configureTestingModule({ imports: [SearchResultsMap] }).compileComponents();
    const leaflet = (await import('leaflet')).default;
    const fitBounds = vi.spyOn(leaflet.Map.prototype, 'fitBounds');
    const fixture = TestBed.createComponent(SearchResultsMap);

    fixture.componentRef.setInput('records', [record(-9.6658, -35.735), record(-9.75, -36)]);
    await fixture.whenStable();
    await vi.waitFor(() => expect(fitBounds).toHaveBeenCalledOnce());

    const initialBounds = fitBounds.mock.calls[0][0] as LatLngBounds;
    expect(initialBounds.contains([-9.6658, -35.735])).toBe(true);
    expect(initialBounds.contains([-9.75, -36])).toBe(true);

    fixture.componentRef.setInput('records', [record(-9.5, -35.5)]);
    await fixture.whenStable();

    expect(fitBounds).toHaveBeenCalledOnce();
  });
});
