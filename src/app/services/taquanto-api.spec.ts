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
        headers: { Age: '3600', 'X-Cache': 'STALE' },
      },
    );

    expect(response?.data.pagination.total_records).toBe(51);
    expect(response?.cacheStatus).toBe('STALE');
    expect(response?.ageSeconds).toBe(3600);
  });

  it('tolerates absent cache headers', () => {
    let response: PriceSearchResponse | undefined;

    api
      .prices('arroz', { municipality: '2700300', days: 3, limit: 50, page: 1 })
      .subscribe((value) => {
        response = value;
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

    expect(response?.cacheStatus).toBeNull();
    expect(response?.ageSeconds).toBeNull();
  });
});
