import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import {
  CacheStatus,
  FuelSearchResponse,
  PricePageParams,
  PriceRecord,
  TaquantoApi,
} from '../../services/taquanto-api';
import { FuelsPage } from './fuels';

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

  beforeEach(async () => {
    api = new TaquantoApiStub();
    routeParams = {};
    router = { navigate: vi.fn(() => Promise.resolve(true)) };

    await TestBed.configureTestingModule({
      imports: [FuelsPage],
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

    fixture = TestBed.createComponent(FuelsPage);
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.expectOne('/assets/alagoas-municipios.geojson').flush(municipalityMap);
    await fixture.whenStable();
  });

  it('offers the six official fuel types and searches with URL-backed filters', async () => {
    api.results = [fuelRecord];
    const element = fixture.nativeElement as HTMLElement;
    const type = element.querySelector<HTMLSelectElement>('#fuel-type')!;
    const municipality = element.querySelector<HTMLSelectElement>('#municipality-select')!;
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
    municipality.value = '2700300';
    municipality.dispatchEvent(new Event('change'));
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
    expect(element.querySelector('.favorite-toggle')).toBeNull();
    expect(element.textContent).not.toContain('oferta garantida');
  });

  it('loads a shared fuel URL directly', async () => {
    fixture.destroy();
    routeParams = { type: '5', municipality: '2700300', days: '7' };

    fixture = TestBed.createComponent(FuelsPage);
    await fixture.whenStable();
    http.expectOne('/assets/alagoas-municipios.geojson').flush(municipalityMap);
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLSelectElement>('#fuel-type')?.value).toBe('5');
    expect(element.querySelector<HTMLSelectElement>('#municipality-select')?.value).toBe('2700300');
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
  });
});
