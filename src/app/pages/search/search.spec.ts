import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
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
  fail = false;
  results: PriceRecord[] = [];
  pageResults = new Map<number, PriceRecord[]>();
  totalPages = 1;
  pendingResponse: Subject<SearchResponse> | null = null;

  prices(query: string, params: PricePageParams) {
    this.priceCalls.push({ query, params });
    if (this.pendingResponse) {
      return this.pendingResponse.asObservable();
    }
    if (this.fail) {
      return throwError(() => new Error('API unavailable'));
    }
    const results = this.pageResults.get(params.page) ?? this.results;
    const totalRecords = this.pageResults.size
      ? [...this.pageResults.values()].reduce((total, page) => total + page.length, 0)
      : results.length;
    return of<SearchResponse>({
      query,
      source: 'test',
      results,
      pagination: {
        page: params.page,
        page_size: params.limit,
        page_records: results.length,
        total_records: totalRecords,
        total_pages: this.totalPages,
        first_page: params.page === 1,
        last_page: params.page >= this.totalPages,
      },
    });
  }
}

describe('SearchPage', () => {
  let fixture: ComponentFixture<SearchPage>;
  let api: TaquantoApiStub;
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let routeParams: Record<string, string>;
  let autoIntersect: boolean;

  beforeEach(async () => {
    localStorage.clear();
    autoIntersect = false;
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        readonly root = null;
        readonly rootMargin = '';
        readonly thresholds = [];

        constructor(private readonly callback: IntersectionObserverCallback) {}

        disconnect = vi.fn();

        observe(target: Element): void {
          if (autoIntersect) {
            this.callback(
              [{ isIntersecting: true, target } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver,
            );
          }
        }

        takeRecords(): IntersectionObserverEntry[] {
          return [];
        }

        unobserve = vi.fn();
      },
    );
    api = new TaquantoApiStub();
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    routeParams = {};

    await TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: TaquantoApi, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: { get: (key: string) => routeParams[key] ?? null } },
          },
        },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchPage);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.expectOne('/assets/alagoas-municipios.geojson').flush(municipalityMap);
    await fixture.whenStable();
  });

  it('only searches when the form is submitted', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const form = element.querySelector<HTMLFormElement>('form')!;

    expect(
      element.querySelector('.location-filter')!.compareDocumentPosition(form) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.priceCalls[0]).toEqual({
      query: 'arroz',
      params: { municipality: '2704302', days: 1, limit: 50, page: 1 },
    });

    const period = element.querySelector<HTMLSelectElement>('#search-period')!;
    period.value = '3';
    period.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    const municipality = element.querySelector<HTMLSelectElement>('#municipality-select')!;
    municipality.value = '2700300';
    municipality.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(api.priceCalls).toHaveLength(1);

    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.priceCalls[1]).toEqual({
      query: 'arroz',
      params: { municipality: '2700300', days: 3, limit: 50, page: 1 },
    });
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { q: 'arroz', municipality: '2700300', days: 3 },
      relativeTo: expect.anything(),
      replaceUrl: true,
    });
  });

  it('loads URL filters without calling the prices API', async () => {
    fixture.destroy();
    routeParams = { q: 'arroz', municipality: '2700300', days: '3' };

    fixture = TestBed.createComponent(SearchPage);
    await fixture.whenStable();
    http.expectOne('/assets/alagoas-municipios.geojson').flush(municipalityMap);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('#product-query')?.value).toBe('arroz');
    expect(element.querySelector<HTMLSelectElement>('#search-period')?.value).toBe('3');
    expect(element.querySelector<HTMLSelectElement>('#municipality-select')?.value).toBe('2700300');
    expect(api.priceCalls).toHaveLength(0);
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

    const dialog = element.querySelector<HTMLDialogElement>('dialog');
    expect(dialog?.textContent).toContain('R$ 6,29');
    expect(dialog?.textContent).toContain('Valor declarado');
    expect(dialog?.textContent).toContain('R$ 0,00');
    expect(dialog?.textContent).toContain('7891234567890');
    expect(dialog?.textContent).toContain('Venda em');
    expect(dialog?.textContent).toContain('Localização no mapa não informada pela fonte');
  });

  it('favorites the same sale record from the result card and its details', async () => {
    api.results = [priceRecord];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = priceRecord.gtin;
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    const cardToggle = element.querySelector<HTMLButtonElement>('.favorite-toggle')!;
    expect(cardToggle.getAttribute('aria-pressed')).toBe('false');
    cardToggle.click();
    await fixture.whenStable();
    expect(cardToggle.getAttribute('aria-pressed')).toBe('true');

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();
    expect(
      element
        .querySelector<HTMLDialogElement>('dialog .favorite-toggle')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('loads the next page when results create an intersecting scroll trigger', async () => {
    api.totalPages = 3;
    api.pageResults.set(1, [priceRecord]);
    api.pageResults.set(2, [
      { ...priceRecord, description: 'Feijão carioca 1kg', gtin: '7891234567891' },
    ]);
    api.pageResults.set(3, [
      { ...priceRecord, description: 'Macarrão 500g', gtin: '7891234567892' },
    ]);
    autoIntersect = true;
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));

    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(api.priceCalls.at(-1)?.params.page).toBe(3);
    });
    expect(element.textContent).toContain('Arroz branco 1kg');
    expect(element.textContent).toContain('Feijão carioca 1kg');
    expect(element.textContent).toContain('Macarrão 500g');
    expect(element.textContent).toContain('Todos os registros carregados.');
  });

  it('shows the precise marker when API coordinates are numeric strings', async () => {
    api.results = [
      {
        ...priceRecord,
        location: {
          ...priceRecord.location,
          latitude: '-9.6658',
          longitude: '-35.735',
        },
      },
    ];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = priceRecord.gtin;
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('.map-empty-message')).toBeNull();
    await vi.waitFor(() => expect(element.querySelector('.search-sale-marker')).not.toBeNull());
    const marker = element.querySelector<SVGElement>('.search-sale-marker')!;
    expect(marker.getAttribute('role')).toBe('button');
    marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(element.querySelector('.leaflet-popup')).not.toBeNull();
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

    input.value = '';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    element.querySelector<HTMLButtonElement>('.recent-search-chip')!.click();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(input.value).toBe('arroz');
    expect(api.priceCalls).toHaveLength(1);
  });

  it('blocks interaction while the API search is pending', async () => {
    const pendingResponse = new Subject<SearchResponse>();
    api.pendingResponse = pendingResponse;
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    fixture.detectChanges();

    expect(element.querySelector('[aria-label="Buscando preços"]')).not.toBeNull();
    expect(element.querySelector('main')?.hasAttribute('inert')).toBe(true);

    pendingResponse.next({
      query: 'arroz',
      source: 'test',
      results: [],
      pagination: {
        page: 1,
        page_size: 50,
        page_records: 0,
        total_records: 0,
        total_pages: 1,
        first_page: true,
        last_page: true,
      },
    });
    pendingResponse.complete();
    await vi.waitFor(() => {
      fixture.detectChanges();
      expect(element.querySelector('[aria-label="Buscando preços"]')).toBeNull();
    });
    expect(element.querySelector('main')?.hasAttribute('inert')).toBe(false);
  });

  it('shows validation warnings and API failure guidance', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const form = element.querySelector<HTMLFormElement>('form')!;

    input.value = 'a';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(element.querySelector('.text-warning')?.textContent).toContain('3 a 50 caracteres');
    expect(element.querySelector('.toast')).toBeNull();

    api.fail = true;
    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível concluir a busca. Tente novamente em instantes.',
    );
    expect(element.querySelector('.text-warning')).toBeNull();
  });

  afterEach(() => {
    http.verify();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });
});
