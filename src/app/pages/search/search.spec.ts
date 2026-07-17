import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import {
  PricePageParams,
  PriceRecord,
  SearchResponse,
  TaquantoApi,
} from '../../services/taquanto-api';
import { SearchPage } from './search';

const municipalityMap = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { code: '2700300', name: 'Arapiraca' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-36.7, -9.8],
            [-36.6, -9.8],
            [-36.6, -9.7],
            [-36.7, -9.8],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { code: '2704302', name: 'Maceió' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-35.8, -9.7],
            [-35.7, -9.7],
            [-35.7, -9.6],
            [-35.8, -9.7],
          ],
        ],
      },
    },
  ],
};

const priceRecord: PriceRecord = {
  description: 'Arroz branco 1kg',
  gtin: '7891234567890',
  source_product_code: '42',
  declared_value_cents: 0,
  sale_value_cents: 629,
  unit: 'UN',
  sold_at: '2026-07-17T12:00:00Z',
  store: { name: 'Mercado Centro', cnpj: '00000000000000' },
  location: {
    latitude: null,
    longitude: null,
    address: 'Rua do Comércio, 10',
    district: 'Centro',
    city: 'Maceió',
    zip_code: '57000-000',
    source: 'sefaz',
  },
};

class TaquantoApiStub {
  readonly priceCalls: { query: string; params: PricePageParams }[] = [];
  results: PriceRecord[] = [];

  prices(query: string, params: PricePageParams) {
    this.priceCalls.push({ query, params });
    return of<SearchResponse>({
      query,
      source: 'test',
      results: this.results,
      pagination: {
        page: params.page,
        page_size: params.limit,
        page_records: this.results.length,
        total_records: this.results.length,
        total_pages: 1,
        first_page: true,
        last_page: true,
      },
    });
  }
}

describe('SearchPage', () => {
  let fixture: ComponentFixture<SearchPage>;
  let api: TaquantoApiStub;
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    api = new TaquantoApiStub();
    router = { navigate: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaquantoApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchPage);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.expectOne('/assets/alagoas-municipios.geojson').flush(municipalityMap);
    await fixture.whenStable();
  });

  it('searches Maceió for one week and refetches when filters change', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const form = element.querySelector<HTMLFormElement>('form')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.priceCalls[0]).toEqual({
      query: 'arroz',
      params: { municipality: '2704302', days: 7, limit: 50, page: 1 },
    });

    const period = element.querySelector<HTMLSelectElement>('#search-period')!;
    period.value = '3';
    period.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const municipality = element.querySelector<HTMLSelectElement>('#municipality-select')!;
    municipality.value = '2700300';
    municipality.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(api.priceCalls.at(-1)).toEqual({
      query: 'arroz',
      params: { municipality: '2700300', days: 3, limit: 50, page: 1 },
    });
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { q: 'arroz', municipality: '2700300', days: 3 },
      relativeTo: expect.anything(),
      replaceUrl: true,
    });
  });

  it('shows the normalized sale fields in record details', async () => {
    api.results = [priceRecord];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = priceRecord.gtin;
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();

    const dialog = element.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain('R$ 6,29');
    expect(dialog?.textContent).toContain('Valor declarado');
    expect(dialog?.textContent).toContain('R$ 0,00');
    expect(dialog?.textContent).toContain('7891234567890');
    expect(dialog?.textContent).toContain('Venda em');
    expect(dialog?.textContent).toContain('Localização no mapa não informada pela fonte');
  });

  it('saves recent searches and repeats them from the chip', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-16T01:00:00Z').getTime());
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    const chip = element.querySelector<HTMLButtonElement>('.recent-search-chip');
    expect(chip?.textContent).toContain('arroz');
    expect(chip?.textContent).toContain('agora');
    expect(JSON.parse(localStorage.getItem('taquanto:recent-searches') ?? '[]')).toHaveLength(1);

    chip!.click();
    await fixture.whenStable();
    expect(input.value).toBe('arroz');
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    localStorage.clear();
  });
});
