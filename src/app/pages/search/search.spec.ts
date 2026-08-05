import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import {
  CacheStatus,
  PricePageParams,
  PriceRecord,
  PriceSearchResponse,
  TaquantoApi,
} from '../../services/taquanto-api';
import { SearchPage } from './search';

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

function selectMunicipality(root: HTMLElement, code: string): void {
  root.querySelector<HTMLButtonElement>(`.municipality-option[value="${code}"]`)!.click();
}

class TaquantoApiStub {
  readonly priceCalls: { query: string; params: PricePageParams }[] = [];
  fail = false;
  results: PriceRecord[] = [];
  pageResults = new Map<number, PriceRecord[]>();
  pageResultVersions = new Map<number, PriceRecord[][]>();
  cacheStatuses = new Map<number, CacheStatus[]>();
  cacheStatus: CacheStatus = 'HIT';
  totalPages = 1;
  pendingResponse: Subject<PriceSearchResponse> | null = null;

  prices(query: string, params: PricePageParams) {
    this.priceCalls.push({ query, params });
    if (this.pendingResponse) {
      return this.pendingResponse.asObservable();
    }
    if (this.fail) {
      return throwError(() => new Error('API unavailable'));
    }
    const results =
      this.pageResultVersions.get(params.page)?.shift() ??
      this.pageResults.get(params.page) ??
      this.results;
    const cacheStatus = this.cacheStatuses.get(params.page)?.shift() ?? this.cacheStatus;
    const totalRecords = this.pageResults.size
      ? [...this.pageResults.values()].reduce((total, page) => total + page.length, 0)
      : results.length;
    return of<PriceSearchResponse>({
      data:
        cacheStatus === 'MISS'
          ? null
          : {
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
            },
      cacheStatus,
      ageSeconds: 0,
    });
  }
}

describe('SearchPage', () => {
  let fixture: ComponentFixture<SearchPage>;
  let api: TaquantoApiStub;
  let http: HttpTestingController;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let routeParams: Record<string, string>;
  let setFiltersPosition: (visible: boolean, top?: number) => void;

  beforeEach(async () => {
    localStorage.clear();
    api = new TaquantoApiStub();
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    routeParams = {};
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          setFiltersPosition = (visible, top = visible ? 0 : -1) =>
            callback(
              [
                {
                  isIntersecting: visible,
                  boundingClientRect: { top },
                } as IntersectionObserverEntry,
              ],
              this as unknown as IntersectionObserver,
            );
        }

        observe(): void {
          setFiltersPosition(false);
        }

        disconnect = vi.fn();
      },
    );

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
  });

  it('coordinates the search through focused components', async () => {
    api.results = [priceRecord];
    const element = fixture.nativeElement as HTMLElement;
    const filterLayout = () =>
      [
        '.query-field',
        '.period-filter',
        'app-municipality-select',
        '.proximity-filter',
        '.search-submit',
      ].map((selector) => ({
        order: getComputedStyle(element.querySelector<HTMLElement>(selector)!).order,
        selector,
      }));
    const expectedLayout = [
      { order: '', selector: '.query-field' },
      { order: '', selector: '.period-filter' },
      { order: '', selector: 'app-municipality-select' },
      { order: '', selector: '.proximity-filter' },
      { order: '', selector: '.search-submit' },
    ];

    expect(element.querySelector('app-search-filters')).not.toBeNull();
    expect(element.querySelector('app-product-search-form')).not.toBeNull();
    expect(element.querySelector('app-recent-searches')).not.toBeNull();
    expect(element.querySelector('app-search-results')).not.toBeNull();
    expect(filterLayout()).toEqual(expectedLayout);
    const scrollIntoView = vi.fn();
    element.querySelector<HTMLElement>('#search-results')!.scrollIntoView = scrollIntoView;

    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element
      .querySelector<HTMLFormElement>('#product-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(filterLayout()).toEqual(expectedLayout);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(element.querySelector('app-sale-record-card')).not.toBeNull();
    expect(element.querySelector('app-search-pagination')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();

    expect(element.querySelector('app-sale-record-detail-dialog dialog')).not.toBeNull();
  });

  it('prioritizes search and keeps the map lazy', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(SearchPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector<HTMLFormElement>('#product-search')!;
    const filters = element.querySelector<HTMLElement>('.location-filter')!;
    const recentSearches = element.querySelector('app-recent-searches')!;

    expect(form.contains(filters)).toBe(true);
    expect(form.classList).toContain('bg-transparent');
    expect(form.classList).not.toContain('bg-base-100');
    expect(getComputedStyle(element.querySelector<HTMLElement>('.query-field')!).order).toBe('');
    expect(getComputedStyle(element.querySelector<HTMLElement>('.period-filter')!).order).toBe('');
    expect(
      getComputedStyle(element.querySelector<HTMLElement>('app-municipality-select')!).order,
    ).toBe('');
    expect(getComputedStyle(element.querySelector<HTMLElement>('.proximity-filter')!).order).toBe(
      '',
    );
    expect(getComputedStyle(element.querySelector<HTMLElement>('.search-submit')!).order).toBe('');
    expect(
      filters.compareDocumentPosition(recentSearches) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(filters.textContent).toContain('Maceió');
    expect(filters.textContent).toContain('Últimas 24 horas');
    expect(filters.querySelector('#municipality-select')?.getAttribute('data-value')).toBe(
      '2704302',
    );
    expect(element.querySelector('#product-query')?.classList).toContain('input-sm');
    expect(element.querySelector<HTMLInputElement>('#product-query')?.required).toBe(true);
    expect(filters.querySelector('#search-period')?.classList).toContain('select-sm');
    expect(filters.querySelector<HTMLSelectElement>('#search-period')?.required).toBe(true);
    expect(filters.querySelector('#municipality-select')?.getAttribute('aria-required')).toBe(
      'true',
    );
    expect(filters.querySelector('#use-location')).not.toBeNull();
    expect(
      filters
        .querySelector('#search-period')!
        .compareDocumentPosition(filters.querySelector('#municipality-select')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    const municipalitySearch = filters.querySelector<HTMLInputElement>('#municipality-search')!;
    municipalitySearch.value = 'maceio';
    municipalitySearch.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(
      Array.from(filters.querySelectorAll<HTMLButtonElement>('.municipality-option')).map(
        ({ value, textContent }) => [value, textContent?.trim()],
      ),
    ).toEqual([['2704302', 'Maceió']]);

    municipalitySearch.value = 'arapiraca';
    municipalitySearch.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    selectMunicipality(filters, '2700300');
    await fixture.whenStable();
    expect(filters.querySelector('#municipality-select')?.getAttribute('data-value')).toBe(
      '2700300',
    );

    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.priceCalls).toEqual([
      {
        query: 'arroz',
        params: { municipality: '2700300', days: 1, limit: 50, page: 1 },
      },
    ]);
  });

  it('confirms current location once and searches with the selected radius', async () => {
    api.results = [
      {
        ...priceRecord,
        location: { ...priceRecord.location, latitude: -9.6658, longitude: -35.735 },
      },
    ];
    const getCurrentPosition = vi.fn((success: PositionCallback) =>
      success({
        coords: {
          accuracy: 10,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          latitude: -9.665,
          longitude: -35.735,
          speed: null,
          toJSON: () => ({}),
        },
        timestamp: Date.now(),
        toJSON: () => ({}),
      }),
    );
    vi.stubGlobal('navigator', {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      geolocation: { getCurrentPosition },
    });
    const element = fixture.nativeElement as HTMLElement;
    const useLocation = element.querySelector<HTMLInputElement>('#use-location')!;

    useLocation.checked = true;
    useLocation.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(element.querySelector('app-location-permission-dialog dialog')).not.toBeNull();
    expect(element.querySelector('#municipality-select')).toBeNull();
    element
      .querySelector<HTMLButtonElement>('app-location-permission-dialog .btn-primary')!
      .click();
    await fixture.whenStable();

    expect(getCurrentPosition).toHaveBeenCalledOnce();
    expect(localStorage.getItem('taquanto:location-consent')).toBe('true');
    expect(element.querySelector('app-location-permission-dialog')).toBeNull();
    const radius = element.querySelector<HTMLSelectElement>('#search-radius')!;
    expect(radius.required).toBe(true);
    expect([...radius.options].map(({ text }) => text)).toEqual(['5 km', '10 km', '15 km']);
    radius.value = '15';
    radius.dispatchEvent(new Event('change'));
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element
      .querySelector<HTMLFormElement>('#product-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.priceCalls.at(-1)).toEqual({
      query: 'arroz',
      params: {
        latitude: -9.665,
        longitude: -35.735,
        radius: 15,
        days: 1,
        limit: 50,
        page: 1,
      },
    });
    await vi.waitFor(() => expect(element.querySelector('.results-sale-marker')).not.toBeNull());
    expect(element.querySelector('.search-radius')).not.toBeNull();
    expect(element.textContent).toContain('1 de 1 registros exibidos no mapa.');
    const resultsMap = element.querySelector<HTMLElement>('.results-map')!;
    resultsMap.scrollIntoView = vi.fn();
    element.querySelector<HTMLButtonElement>('.map-record-button')!.click();
    expect(resultsMap.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
    expect(element.querySelector('.leaflet-popup')).not.toBeNull();
    const marker = element.querySelector<SVGElement>('.results-sale-marker')!;
    marker.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    const popup = element.querySelector('.leaflet-popup')?.textContent;
    expect(popup).toContain('R$ 6,29 / UN');
    expect(popup).toContain('Arroz Branco 1kg');
    expect(popup).toContain('Mercado Centro');
    expect(popup).toContain('Rua Do Comércio, 10');
    expect(element.querySelector('.recent-search-link')?.textContent).toContain(
      'Arroz - Perto de mim (15 km) - Últimas 24 horas',
    );
    expect(JSON.parse(localStorage.getItem('taquanto:recent-searches') ?? '[]')[0]).toEqual({
      query: 'arroz',
      municipality: { code: '2704302', name: 'Maceió' },
      days: 1,
      useLocation: true,
      radius: 15,
    });

    localStorage.removeItem('taquanto:location-consent');
    input.value = 'feijão';
    input.dispatchEvent(new Event('input'));
    element
      .querySelector<HTMLFormElement>('#product-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(element.querySelector('app-location-permission-dialog dialog')).not.toBeNull();
    expect(api.priceCalls).toHaveLength(1);
    element
      .querySelector<HTMLButtonElement>('app-location-permission-dialog .btn-primary')!
      .click();
    await fixture.whenStable();
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(element.querySelector('app-location-permission-dialog')).toBeNull();
    expect(api.priceCalls.at(-1)?.query).toBe('feijão');

    element.querySelector<HTMLInputElement>('#use-location')!.click();
    localStorage.removeItem('taquanto:location-consent');
    element.querySelector<HTMLButtonElement>('.recent-search-link')!.click();
    await fixture.whenStable();
    expect(element.querySelector('app-location-permission-dialog dialog')).not.toBeNull();
    expect(api.priceCalls).toHaveLength(2);
    element
      .querySelector<HTMLButtonElement>('app-location-permission-dialog .btn-primary')!
      .click();
    await fixture.whenStable();
    expect(getCurrentPosition).toHaveBeenCalledTimes(3);
    expect(api.priceCalls.at(-1)?.params).toMatchObject({
      latitude: -9.665,
      longitude: -35.735,
      radius: 15,
    });
  });

  it('only searches when the form is submitted', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const form = element.querySelector<HTMLFormElement>('form')!;

    expect(
      form.compareDocumentPosition(element.querySelector('.location-filter')!) &
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

    selectMunicipality(element, '2700300');
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

  it('loads URL filters and searches with them', async () => {
    fixture.destroy();
    routeParams = { q: 'arroz', municipality: '2700300', days: '3' };

    fixture = TestBed.createComponent(SearchPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLInputElement>('#product-query')?.value).toBe('arroz');
    expect(element.querySelector<HTMLSelectElement>('#search-period')?.value).toBe('3');
    expect(element.querySelector('#municipality-select')?.getAttribute('data-value')).toBe(
      '2700300',
    );
    expect(api.priceCalls).toEqual([
      {
        query: 'arroz',
        params: { municipality: '2700300', days: 3, limit: 50, page: 1 },
      },
    ]);
  });

  it('shows the normalized sale fields in record details', async () => {
    api.results = [priceRecord];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = priceRecord.gtin;
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    const lowestPrice = element.querySelector<HTMLElement>('.lowest-price-tag');
    const description = element.querySelector<HTMLElement>('.card-title-tooltip');
    const detailButton = element.querySelector<HTMLButtonElement>('.detail-button')!;
    const address = element.querySelector<HTMLElement>('.card-location-slot .tooltip');
    expect(lowestPrice?.dataset['tip']).toBe('Menor valor entre os registros desta página');
    expect(description?.dataset['tip']).toBe('Arroz Branco 1kg');
    expect(address?.dataset['tip']).toBe('Rua Do Comércio, 10');
    expect(detailButton.textContent?.trim()).toBe('Detalhes');

    detailButton.click();
    await fixture.whenStable();

    const dialog = element.querySelector<HTMLDialogElement>('dialog');
    expect(dialog?.textContent).toContain('R$ 6,29');
    expect(dialog?.textContent).toContain('Valor declarado');
    expect(dialog?.textContent).toContain('R$ 0,00');
    expect(dialog?.textContent).toContain('7891234567890');
    expect(dialog?.textContent).toContain('Rua Do Comércio, 10');
    expect(dialog?.textContent).not.toContain('CNPJ');
    expect(dialog?.textContent).toContain('Horário da venda');
    expect(dialog?.textContent).not.toContain('57000-000');
    expect(dialog?.textContent).toContain('Localização no mapa não informada pela fonte');
  });

  it('highlights the lowest sale value of the page, not the first record', async () => {
    api.results = [
      {
        ...priceRecord,
        description: 'Arroz premium',
        gtin: '7891234567890',
        sale_value_cents: 799,
      },
      {
        ...priceRecord,
        description: 'Arroz econômico',
        gtin: '7891234567891',
        sale_value_cents: 599,
      },
      { ...priceRecord, description: 'Arroz comum', gtin: '7891234567892', sale_value_cents: 699 },
    ];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = priceRecord.gtin;
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    const tags = element.querySelectorAll<HTMLElement>('.lowest-price-tag');
    expect(tags).toHaveLength(1);
    expect(tags[0].closest('.price-card')?.textContent).toContain('Arroz Econômico');
    expect(tags[0].dataset['tip']).toBe('Menor valor entre os registros desta página');
    expect(tags[0].getAttribute('aria-label')).toBe('Menor valor entre os registros desta página');
    expect(
      element.querySelectorAll('.price-card')[0].querySelector('.lowest-price-tag'),
    ).toBeNull();
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
    expect(cardToggle.dataset['tip']).toBe('Adicionar aos favoritos');
    cardToggle.click();
    await fixture.whenStable();
    expect(cardToggle.getAttribute('aria-pressed')).toBe('true');
    expect(
      (
        JSON.parse(localStorage.getItem('taquanto:favorite-sales') ?? '[]') as {
          search?: unknown;
        }[]
      )[0].search,
    ).toEqual({
      query: priceRecord.gtin,
      municipality: { code: '2704302', name: 'Maceió' },
      days: 1,
    });

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();
    expect(
      element
        .querySelector<HTMLDialogElement>('dialog .favorite-toggle')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
  });

  it('loads a page selected in the numbered pagination', async () => {
    api.totalPages = 3;
    api.pageResults.set(
      1,
      Array.from({ length: 50 }, () => priceRecord),
    );
    api.pageResults.set(
      2,
      Array.from({ length: 50 }, () => ({
        ...priceRecord,
        description: 'Feijão carioca 1kg',
        gtin: '7891234567891',
      })),
    );
    api.pageResults.set(
      3,
      Array.from({ length: 26 }, () => ({
        ...priceRecord,
        description: 'Macarrão 500g',
        gtin: '7891234567892',
      })),
    );
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const scrollIntoView = vi.fn();
    const scrollToFilters = vi.fn();
    element.querySelector<HTMLElement>('#search-results')!.scrollIntoView = scrollIntoView;
    element.querySelector<HTMLElement>('#product-search')!.scrollIntoView = scrollToFilters;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(element.textContent).toContain('1-50 de 126 registros');
    expect(element.querySelector('[aria-current="page"]')?.textContent).toContain('1');
    element.querySelector<HTMLButtonElement>('.back-to-search')!.click();
    await fixture.whenStable();

    expect(scrollToFilters).toHaveBeenCalledTimes(1);
    expect(element.querySelector('.back-to-search')).toBeNull();
    setFiltersPosition(false);
    await fixture.whenStable();
    expect(element.querySelector('.back-to-search')).not.toBeNull();
    setFiltersPosition(true);
    await fixture.whenStable();
    expect(element.querySelector('.back-to-search')).toBeNull();
    setFiltersPosition(false, 1);
    await fixture.whenStable();
    expect(element.querySelector('.back-to-search')).toBeNull();
    setFiltersPosition(false);
    await fixture.whenStable();
    element.querySelector<HTMLButtonElement>('[aria-label="Página 2"]')!.click();
    await fixture.whenStable();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(api.priceCalls.at(-1)?.params.page).toBe(2);
    expect(element.textContent).toContain('51-100 de 126 registros');
    expect(element.textContent).toContain('Feijão Carioca 1kg');
    expect(element.textContent).not.toContain('Arroz Branco 1kg');

    element.querySelector<HTMLButtonElement>('[aria-label="Página 3"]')!.click();
    await fixture.whenStable();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(api.priceCalls.at(-1)?.params.page).toBe(3);
    expect(element.textContent).toContain('101-126 de 126 registros');
    expect(element.querySelector('[aria-current="page"]')?.textContent).toContain('3');
    expect(element.textContent).toContain('Macarrão 500g');
  });

  it('hides the records count while loading another page', async () => {
    api.totalPages = 2;
    api.pageResults.set(
      1,
      Array.from({ length: 50 }, () => priceRecord),
    );
    const page2 = Array.from({ length: 20 }, () => ({
      ...priceRecord,
      description: 'Feijão carioca 1kg',
      gtin: '7891234567891',
    }));
    api.pageResults.set(2, page2);

    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(element.textContent).toContain('1-50 de 70 registros');

    const pendingResponse = new Subject<PriceSearchResponse>();
    api.pendingResponse = pendingResponse;
    element.querySelector<HTMLButtonElement>('[aria-label="Página 2"]')!.click();

    await vi.waitFor(() => expect(element.textContent).not.toContain('1-50 de 70 registros'));

    pendingResponse.next({
      data: {
        query: 'arroz',
        source: 'test',
        results: page2,
        pagination: {
          page: 2,
          page_size: 50,
          page_records: page2.length,
          total_records: 70,
          total_pages: 2,
          first_page: false,
          last_page: true,
        },
      },
      cacheStatus: 'HIT',
      ageSeconds: 0,
    });
    pendingResponse.complete();
    await fixture.whenStable();

    expect(element.textContent).toContain('51-70 de 70 registros');
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

  it('saves and repeats a complete recent search from its compact link', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const period = element.querySelector<HTMLSelectElement>('#search-period')!;

    period.value = '3';
    period.dispatchEvent(new Event('change'));
    selectMunicipality(element, '2700300');
    await fixture.whenStable();

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    const link = element.querySelector<HTMLButtonElement>('.recent-search-link');
    const recentSearchesTitle = element.querySelector('.recent-searches-title');
    const recentSearches = element.querySelector('.recent-searches')!;
    const locationFilter = element.querySelector('.location-filter')!;
    expect(
      locationFilter.compareDocumentPosition(recentSearches) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(recentSearchesTitle?.textContent).toContain('Suas últimas pesquisas');
    expect(recentSearchesTitle?.querySelector('svg')).not.toBeNull();
    expect(recentSearchesTitle?.firstElementChild?.tagName).toBe('SPAN');
    expect(recentSearchesTitle?.classList).toContain('eyebrow');
    expect(link?.textContent).toContain('Arroz - Arapiraca - Últimos 3 dias');
    expect(JSON.parse(localStorage.getItem('taquanto:recent-searches') ?? '[]')).toEqual([
      {
        query: 'arroz',
        municipality: { code: '2700300', name: 'Arapiraca' },
        days: 3,
      },
    ]);

    input.value = '';
    input.dispatchEvent(new Event('input'));
    period.value = '1';
    period.dispatchEvent(new Event('change'));
    selectMunicipality(element, '2704302');
    await fixture.whenStable();

    expect(link?.textContent).toContain('Últimos 3 dias');
    const scrollIntoView = vi.fn();
    element.querySelector<HTMLElement>('#search-results')!.scrollIntoView = scrollIntoView;
    element.querySelector<HTMLButtonElement>('.recent-search-link')!.click();
    await fixture.whenStable();

    expect(input.value).toBe('arroz');
    expect(period.value).toBe('3');
    expect(element.querySelector('#municipality-select')?.getAttribute('data-value')).toBe(
      '2700300',
    );
    expect(api.priceCalls).toHaveLength(2);
    expect(api.priceCalls[1]).toEqual({
      query: 'arroz',
      params: { municipality: '2700300', days: 3, limit: 50, page: 1 },
    });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('shows skeletons without blocking a replacement search', async () => {
    const pendingResponse = new Subject<PriceSearchResponse>();
    api.pendingResponse = pendingResponse;
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const scrollIntoView = vi.fn();
    element.querySelector<HTMLElement>('#search-results')!.scrollIntoView = scrollIntoView;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    const form = element.querySelector<HTMLFormElement>('form')!;
    form.dispatchEvent(new SubmitEvent('submit'));
    form.dispatchEvent(new SubmitEvent('submit'));

    expect(api.priceCalls).toHaveLength(1);
    await vi.waitFor(() => expect(element.querySelectorAll('.skeleton')).toHaveLength(20));
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(element.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(element.querySelector('.back-to-search')).toBeNull();

    pendingResponse.next({
      data: {
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
      },
      cacheStatus: 'HIT',
      ageSeconds: 0,
    });
    pendingResponse.complete();
    await vi.waitFor(async () => {
      await fixture.whenStable();
      expect(element.querySelector('.skeleton')).toBeNull();
    });
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
    expect(element.querySelector('main')?.hasAttribute('inert')).toBe(false);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(element.querySelector('.back-to-search')).not.toBeNull();
  });

  it('shows an empty state without an error toast for empty successful data', async () => {
    const pendingResponse = new Subject<PriceSearchResponse>();
    api.pendingResponse = pendingResponse;
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));

    pendingResponse.next({ data: null, cacheStatus: 'HIT', ageSeconds: null });
    pendingResponse.complete();
    await fixture.whenStable();

    expect(element.textContent).toContain('Nenhum registro encontrado para esses filtros.');
    expect(element.querySelector('.empty-results')).not.toBeNull();
    expect(element.querySelector('.text-warning')).toBeNull();
    expect(element.querySelector('.toast')).toBeNull();
  });

  it('aborts a pending request when the query changes', async () => {
    const pendingResponse = new Subject<PriceSearchResponse>();
    api.pendingResponse = pendingResponse;
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));

    await vi.waitFor(() => expect(pendingResponse.observed).toBe(true));
    input.value = 'feijao';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(pendingResponse.observed).toBe(false);
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  it('polls a cache miss every five seconds until fresh data arrives', async () => {
    vi.useFakeTimers();
    api.pageResultVersions.set(1, [[], [priceRecord]]);
    api.cacheStatuses.set(1, ['MISS', 'HIT']);
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await vi.advanceTimersByTimeAsync(0);

    expect(api.priceCalls).toHaveLength(1);
    expect(element.textContent).toContain('Buscando dados atualizados.');
    expect(element.querySelector('.skeleton')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersToNextFrame();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve));

    expect(api.priceCalls).toHaveLength(2);
    expect(element.textContent).toContain('Arroz Branco 1kg');
    expect(element.textContent).toContain('Resultados atualizados.');
    expect(element.querySelector('.skeleton')).toBeNull();
  });

  it('revalidates the current stale page without blocking cached results', async () => {
    vi.useFakeTimers();
    api.pageResultVersions.set(1, [
      [{ ...priceRecord, description: 'Arroz em cache' }],
      [{ ...priceRecord, description: 'Arroz atualizado' }],
    ]);
    api.cacheStatuses.set(1, ['STALE', 'HIT']);
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const scrollIntoView = vi.fn();
    element.querySelector<HTMLElement>('#search-results')!.scrollIntoView = scrollIntoView;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await vi.advanceTimersByTimeAsync(0);

    expect(element.textContent).toContain('Arroz Em Cache');
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(element.textContent).toContain('Exibindo dados em cache enquanto atualizamos.');
    expect(element.querySelector('main')?.hasAttribute('inert')).toBe(false);

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersToNextFrame();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve));

    expect(api.priceCalls.at(-1)?.params.page).toBe(1);
    expect(element.textContent).toContain('Arroz Atualizado');
    expect(element.textContent).not.toContain('Arroz Em Cache');
    expect(element.textContent).toContain('Resultados atualizados.');
    expect(element.querySelector('.cache-status-dot')).not.toBeNull();
    expect(element.querySelector('.cache-status-dot-pending')).toBeNull();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('cancels stale revalidation when filters change', async () => {
    vi.useFakeTimers();
    api.results = [priceRecord];
    api.cacheStatuses.set(1, ['STALE']);
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await vi.advanceTimersByTimeAsync(0);

    const period = element.querySelector<HTMLSelectElement>('#search-period')!;
    period.value = '3';
    period.dispatchEvent(new Event('change'));
    await vi.advanceTimersByTimeAsync(5000);

    expect(api.priceCalls).toHaveLength(1);
    expect(element.textContent).not.toContain('Exibindo dados em cache enquanto atualizamos.');
  });

  it('keeps stale results after the revalidation limit', async () => {
    vi.useFakeTimers();
    api.results = [priceRecord];
    api.cacheStatus = 'STALE';
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;

    input.value = 'arroz';
    input.dispatchEvent(new Event('input'));
    element.querySelector<HTMLFormElement>('form')!.dispatchEvent(new SubmitEvent('submit'));
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(125000);
    await vi.advanceTimersToNextFrame();

    expect(api.priceCalls).toHaveLength(25);
    expect(element.textContent).toContain('Arroz Branco 1kg');
    expect(element.textContent).toContain(
      'Não foi possível atualizar agora; exibindo dados em cache.',
    );
    expect(element.querySelector('.cache-status-dot-pending')).not.toBeNull();
  });

  it('shows validation warnings and API failure guidance', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const form = element.querySelector<HTMLFormElement>('form')!;

    input.value = 'a';
    input.dispatchEvent(new Event('input'));
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(element.querySelector('.text-warning')?.textContent).toContain('3 a 100 caracteres');
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

  it('warns and disables the button when the query exceeds 100 characters', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query')!;
    const submit = element.querySelector<HTMLButtonElement>('button[type="submit"]')!;

    input.value = 'x'.repeat(100);
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(submit.disabled).toBe(false);
    expect(element.querySelector('#product-query-error')).toBeNull();

    input.value = 'x'.repeat(101);
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();

    expect(submit.disabled).toBe(true);
    const error = element.querySelector<HTMLElement>('#product-query-error');
    expect(error).not.toBeNull();
    expect(error?.textContent?.trim()).toBe('O campo aceita no máximo 100 caracteres.');
    expect(error?.classList).toContain('text-xs');
    expect(error?.classList).toContain('mb-2');
    expect(input.classList).toContain('input-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe('product-query-error');
    expect(getComputedStyle(submit).backgroundColor).toBe('rgb(107, 114, 128)');
    expect(api.priceCalls).toHaveLength(0);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });
});
