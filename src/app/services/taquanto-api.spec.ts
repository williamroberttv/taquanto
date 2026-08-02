import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { PriceSearchResponse, TaquantoApi } from './taquanto-api';

describe('TaquantoApi', () => {
  let api: TaquantoApi;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    api = TestBed.inject(TaquantoApi);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('requests paginated prices for a municipality and period', () => {
    let response: PriceSearchResponse | undefined;

    api
      .prices('arroz', { municipality: '2700300', days: 3, limit: 50, page: 2 })
      .subscribe((value) => {
        response = value;
      });

    const request = http.expectOne((req) => req.url === 'http://localhost:8080/v1/prices');
    expect(request.request.params.get('query')).toBe('arroz');
    expect(request.request.params.get('municipality')).toBe('2700300');
    expect(request.request.params.get('days')).toBe('3');
    expect(request.request.params.get('limit')).toBe('50');
    expect(request.request.params.get('page')).toBe('2');

    request.flush(
      {
        query: 'arroz',
        source: 'test',
        results: [],
        pagination: {
          page: 2,
          page_size: 50,
          page_records: 1,
          total_records: 51,
          total_pages: 2,
          first_page: false,
          last_page: true,
        },
      },
      {
        headers: {
          'X-TaQuanto-Cache-Age': '3600',
          'X-TaQuanto-Cache-Status': 'STALE',
        },
      },
    );

    expect(response?.data?.pagination.total_records).toBe(51);
    expect(response?.cacheStatus).toBe('STALE');
    expect(response?.ageSeconds).toBe(3600);
  });

  it('maps an accepted cache miss without a search body', () => {
    let response: PriceSearchResponse | undefined;

    api
      .prices('arroz', { municipality: '2700300', days: 3, limit: 50, page: 1 })
      .subscribe((value) => {
        response = value;
      });

    const request = http.expectOne((req) => req.url === 'http://localhost:8080/v1/prices');
    request.flush(null, {
      headers: {
        'X-TaQuanto-Cache-Retry-After': '5',
        'X-TaQuanto-Cache-Status': 'MISS',
      },
      status: 202,
      statusText: 'Accepted',
    });

    expect(response).toEqual({
      data: null,
      cacheStatus: 'MISS',
      ageSeconds: null,
    });
  });

  it('maps a successful empty response as empty data', () => {
    let response: PriceSearchResponse | undefined;

    api
      .prices('arroz', { municipality: '2700300', days: 3, limit: 50, page: 1 })
      .subscribe((value) => {
        response = value;
      });

    const request = http.expectOne((req) => req.url === 'http://localhost:8080/v1/prices');
    request.flush(null, {
      headers: { 'X-TaQuanto-Cache-Status': 'HIT' },
      status: 200,
      statusText: 'OK',
    });

    expect(response).toEqual({ data: null, cacheStatus: 'HIT', ageSeconds: null });
  });

  it('rejects a response without cache metadata', () => {
    let failure: unknown;

    api.prices('arroz', { municipality: '2700300', days: 3, limit: 50, page: 1 }).subscribe({
      error: (error: unknown) => {
        failure = error;
      },
    });

    const request = http.expectOne((req) => req.url === 'http://localhost:8080/v1/prices');
    request.flush({
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

    expect(failure).toEqual(new Error('Invalid prices cache response'));
  });
});
