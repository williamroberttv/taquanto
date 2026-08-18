import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Analytics } from '../../services/analytics';
import {
  CacheStatus,
  FuelSearchResponse,
  PricePageParams,
  PriceRecord,
  TaquantoApi,
} from '../../services/taquanto-api';
import { FuelsPage } from './fuels';

const fuelRecord: PriceRecord = {
  description: 'Gasolina aditivada',
  gtin: '',
  source_product_code: '2',
  declared_value_cents: 639,
  sale_value_cents: 629,
  unit: 'L',
  sold_at: '2026-08-03T12:00:00Z',
  store: { name: 'Posto Centro', cnpj: '00000000000000' },
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
  readonly fuelCalls: { type: number; params: PricePageParams }[] = [];
  results: PriceRecord[] = [];
  cacheStatuses: CacheStatus[] = ['HIT'];
  fail = false;
  pendingResponse: Subject<FuelSearchResponse> | null = null;

  fuels(type: number, params: PricePageParams) {
    this.fuelCalls.push({ type, params });
    if (this.pendingResponse) {
      return this.pendingResponse.asObservable();
    }
    if (this.fail) {
      return throwError(() => new Error('API unavailable'));
    }
    const cacheStatus = this.cacheStatuses.shift() ?? 'HIT';
    return of<FuelSearchResponse>({
      data:
        cacheStatus === 'MISS'
          ? null
          : {
              type,
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
            },
      cacheStatus,
      ageSeconds: 0,
    });
  }
}

describe('FuelsPage', () => {
  let fixture: ComponentFixture<FuelsPage>;
  let api: TaquantoApiStub;
  let http: HttpTestingController;
  let routeParams: Record<string, string>;
  let router: { navigate: ReturnType<typeof vi.fn> };
  let setFiltersPosition: (visible: boolean, top?: number) => void;
  let analytics: { capture: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    localStorage.clear();
    api = new TaquantoApiStub();
    routeParams = {};
    router = { navigate: vi.fn(() => Promise.resolve(true)) };
    analytics = { capture: vi.fn() };
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
          setFiltersPosition(true);
        }

        disconnect = vi.fn();
      },
    );

    await TestBed.configureTestingModule({
      imports: [FuelsPage],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: Analytics, useValue: analytics },
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

    fixture = TestBed.createComponent(FuelsPage);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('starts with compact shared filters without the visual municipality selector', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector<HTMLFormElement>('#fuel-search')!;
    expect(form.classList).toContain('bg-transparent');
    expect(form.classList).not.toContain('bg-base-100');
    const municipalitySearch = element.querySelector<HTMLInputElement>('#municipality-search')!;
    expect(municipalitySearch).not.toBeNull();
    expect(element.querySelector('#municipality-select')?.getAttribute('data-value')).toBe(
      '2704302',
    );
    expect(element.querySelector('#fuel-type')?.classList).toContain('select-sm');
    expect(element.querySelector<HTMLSelectElement>('#fuel-type')?.required).toBe(true);
    expect(element.querySelector('#search-period')?.classList).toContain('select-sm');
    expect(element.querySelector<HTMLSelectElement>('#search-period')?.required).toBe(true);
    expect(getComputedStyle(element.querySelector<HTMLElement>('.period-filter')!).order).toBe('');
    expect(getComputedStyle(element.querySelector<HTMLElement>('.fuel-type-filter')!).order).toBe(
      '',
    );
    expect(
      getComputedStyle(element.querySelector<HTMLElement>('app-municipality-select')!).order,
    ).toBe('');
    expect(getComputedStyle(element.querySelector<HTMLElement>('.proximity-filter')!).order).toBe(
      '',
    );
    expect(getComputedStyle(element.querySelector<HTMLElement>('.search-submit')!).order).toBe('');
    expect(element.querySelector('#municipality-select')?.getAttribute('aria-required')).toBe(
      'true',
    );

    municipalitySearch.value = 'maceio';
    municipalitySearch.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    const filteredMunicipalities = Array.from(
      element.querySelectorAll<HTMLButtonElement>('.municipality-option'),
    ).map(({ value, textContent }) => [value, textContent?.trim()]);

    expect(filteredMunicipalities).toEqual([['2704302', 'Maceió']]);
  });

  it('shows the return button only after the form leaves the viewport', async () => {
    api.results = [fuelRecord];
    const element = fixture.nativeElement as HTMLElement;
    const scrollIntoView = vi.fn();
    element.querySelector<HTMLFormElement>('#fuel-search')!.scrollIntoView = scrollIntoView;

    element
      .querySelector<HTMLFormElement>('#fuel-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(element.querySelector('.back-to-search')).toBeNull();
    setFiltersPosition(false);
    await fixture.whenStable();
    expect(element.querySelector('.back-to-search')).not.toBeNull();

    element.querySelector<HTMLButtonElement>('.back-to-search')!.click();
    await fixture.whenStable();
    expect(scrollIntoView).toHaveBeenCalledOnce();
    expect(element.querySelector('.back-to-search')).toBeNull();

    setFiltersPosition(false, 1);
    await fixture.whenStable();
    expect(element.querySelector('.back-to-search')).toBeNull();
  });

  it('offers the six official fuel types and searches with URL-backed filters', async () => {
    api.results = [fuelRecord];
    const element = fixture.nativeElement as HTMLElement;
    const type = element.querySelector<HTMLSelectElement>('#fuel-type')!;
    const period = element.querySelector<HTMLSelectElement>('#search-period')!;

    expect([...type.options].map((option) => option.text)).toEqual([
      'Gasolina comum',
      'Gasolina aditivada',
      'Álcool',
      'Diesel comum',
      'Diesel aditivado / S10',
      'GNV',
    ]);

    type.value = '2';
    type.dispatchEvent(new Event('change'));
    selectMunicipality(element, '2700300');
    period.value = '3';
    period.dispatchEvent(new Event('change'));
    element
      .querySelector<HTMLFormElement>('#fuel-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(api.fuelCalls).toEqual([
      {
        type: 2,
        params: { municipality: '2700300', days: 3, limit: 50, page: 1 },
      },
    ]);
    expect(analytics.capture).toHaveBeenNthCalledWith(1, 'search_submitted', {
      search_type: 'fuel',
      fuel: 'Gasolina aditivada',
      fuel_id: 2,
      days: 3,
      location_mode: 'municipality',
      municipality: 'Arapiraca',
    });
    expect(analytics.capture).toHaveBeenNthCalledWith(2, 'search_results_loaded', {
      search_type: 'fuel',
      fuel_id: 2,
      result_count: 1,
      days: 3,
      location_mode: 'municipality',
      municipality: 'Arapiraca',
    });
    expect(router.navigate).toHaveBeenLastCalledWith([], {
      queryParams: { type: 2, municipality: '2700300', days: 3 },
      relativeTo: expect.anything(),
      replaceUrl: true,
    });
    expect(element.textContent).toContain('R$ 6,29 / L');
    expect(element.textContent).toContain('Gasolina Aditivada');
    expect(element.textContent).toContain('Posto Centro');
    expect(element.textContent).toContain('Rua Do Comércio, 10');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe(fuelRecord.sold_at);
    const favorite = element.querySelector<HTMLButtonElement>('.favorite-toggle')!;
    expect(favorite.getAttribute('aria-pressed')).toBe('false');
    favorite.click();
    await fixture.whenStable();
    expect(favorite.getAttribute('aria-pressed')).toBe('true');
    expect(analytics.capture).toHaveBeenNthCalledWith(3, 'favorite_added', {
      search_type: 'fuel',
    });
    const mapButton = element.querySelector<HTMLButtonElement>('.map-record-button')!;
    expect(mapButton.disabled).toBe(true);
    expect(mapButton.style.color).toBe('var(--tq-muted)');
    expect(mapButton.getAttribute('aria-label')).toBe('Localização indisponível');
    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();
    expect(element.querySelector('app-sale-record-detail-dialog dialog')).not.toBeNull();
    expect(analytics.capture).toHaveBeenNthCalledWith(4, 'result_detail_opened', {
      search_type: 'fuel',
    });
    expect(element.textContent).not.toContain('oferta garantida');
  });

  it('searches fuels near the confirmed browser location', async () => {
    localStorage.setItem('taquanto:location-consent', 'true');
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

    element.querySelector<HTMLInputElement>('#use-location')!.click();
    await fixture.whenStable();
    element.querySelector<HTMLSelectElement>('#search-radius')!.value = '10';
    element.querySelector<HTMLSelectElement>('#search-radius')!.dispatchEvent(new Event('change'));
    element
      .querySelector<HTMLFormElement>('#fuel-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();

    expect(element.querySelector('#municipality-select')).toBeNull();
    expect(element.querySelector('app-location-permission-dialog')).toBeNull();
    expect(api.fuelCalls.at(-1)).toEqual({
      type: 1,
      params: {
        latitude: -9.665,
        longitude: -35.735,
        radius: 10,
        days: 1,
        limit: 50,
        page: 1,
      },
    });
    expect(analytics.capture).toHaveBeenCalledWith('search_submitted', {
      search_type: 'fuel',
      fuel: 'Gasolina comum',
      fuel_id: 1,
      days: 1,
      location_mode: 'nearby',
      radius: 10,
    });

    localStorage.removeItem('taquanto:location-consent');
    element.querySelector<HTMLSelectElement>('#fuel-type')!.value = '2';
    element.querySelector<HTMLSelectElement>('#fuel-type')!.dispatchEvent(new Event('change'));
    element
      .querySelector<HTMLFormElement>('#fuel-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(element.querySelector('app-location-permission-dialog dialog')).not.toBeNull();
    expect(api.fuelCalls).toHaveLength(1);
    element
      .querySelector<HTMLButtonElement>('app-location-permission-dialog .btn-primary')!
      .click();
    await fixture.whenStable();
    expect(getCurrentPosition).toHaveBeenCalledTimes(2);
    expect(api.fuelCalls.at(-1)?.type).toBe(2);
  });

  it('loads a shared fuel URL directly', async () => {
    fixture.destroy();
    routeParams = { type: '5', municipality: '2700300', days: '7' };

    fixture = TestBed.createComponent(FuelsPage);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLSelectElement>('#fuel-type')?.value).toBe('5');
    expect(element.querySelector('#municipality-select')?.getAttribute('data-value')).toBe(
      '2700300',
    );
    expect(element.querySelector<HTMLSelectElement>('#search-period')?.value).toBe('7');
    expect(api.fuelCalls).toEqual([
      {
        type: 5,
        params: { municipality: '2700300', days: 7, limit: 50, page: 1 },
      },
    ]);
  });

  it('polls cache misses and replaces the loading state with fresh data', async () => {
    vi.useFakeTimers();
    api.results = [fuelRecord];
    api.cacheStatuses = ['MISS', 'HIT'];
    const element = fixture.nativeElement as HTMLElement;

    element
      .querySelector<HTMLFormElement>('#fuel-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await vi.advanceTimersByTimeAsync(0);
    expect(element.textContent).toContain('Buscando dados atualizados.');
    expect(element.querySelector('.skeleton')).not.toBeNull();

    await vi.advanceTimersByTimeAsync(5000);
    await vi.advanceTimersToNextFrame();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve));

    expect(api.fuelCalls).toHaveLength(2);
    expect(element.textContent).toContain('Gasolina Aditivada');
    expect(element.textContent).toContain('Resultados atualizados.');
    expect(
      analytics.capture.mock.calls.filter(([event]) => event === 'search_results_loaded'),
    ).toEqual([
      [
        'search_results_loaded',
        {
          search_type: 'fuel',
          fuel_id: 1,
          result_count: 1,
          days: 1,
          location_mode: 'municipality',
          municipality: 'Maceió',
        },
      ],
    ]);
  });

  it('shows empty and failure states without confusing either one', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const form = element.querySelector<HTMLFormElement>('#fuel-search')!;

    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(element.textContent).toContain('Nenhum registro encontrado para esses filtros.');
    expect(element.querySelector('[role="alert"]')).toBeNull();

    element.querySelector<HTMLSelectElement>('#fuel-type')!.value = '2';
    element.querySelector<HTMLSelectElement>('#fuel-type')!.dispatchEvent(new Event('change'));
    api.fail = true;
    form.dispatchEvent(new SubmitEvent('submit'));
    await fixture.whenStable();
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível concluir a consulta.',
    );
  });

  it('cancels a pending request when a filter changes', async () => {
    const pending = new Subject<FuelSearchResponse>();
    api.pendingResponse = pending;
    const element = fixture.nativeElement as HTMLElement;

    element
      .querySelector<HTMLFormElement>('#fuel-search')!
      .dispatchEvent(new SubmitEvent('submit'));
    await vi.waitFor(() => expect(pending.observed).toBe(true));
    const period = element.querySelector<HTMLSelectElement>('#search-period')!;
    period.value = '3';
    period.dispatchEvent(new Event('change'));
    await fixture.whenStable();

    expect(pending.observed).toBe(false);
    expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')?.disabled).toBe(false);
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
  });
});
