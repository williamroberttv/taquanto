import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { SearchResponse, TaquantoApi } from './taquanto-api';

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

  it("requests categories through the configured API base URL", () => {
    let response: SearchResponse | undefined;

    api.categories("arroz").subscribe((value) => {
      response = value;
    });

    const request = http.expectOne((req) => req.url === "http://localhost:8080/v1/categories");
    expect(request.request.params.get("query")).toBe("arroz");

    request.flush({
      query: "arroz",
      source: "test",
      results: [],
      categories: [{ source_sku: "50000000", name: "Alimentos", count: 2 }],
    });

    expect(response?.categories?.[0]?.source_sku).toBe("50000000");
  });

  it('requests paginated prices with category', () => {
    let response: SearchResponse | undefined;

    api.prices('arroz', { category: '50000000', limit: 10, page: 2 }).subscribe((value) => {
      response = value;
    });

    const request = http.expectOne((req) => req.url === 'http://localhost:8080/v1/prices');
    expect(request.request.params.get('query')).toBe('arroz');
    expect(request.request.params.get('category')).toBe('50000000');
    expect(request.request.params.get('limit')).toBe('10');
    expect(request.request.params.get('page')).toBe('2');

    request.flush({
      query: 'arroz',
      source: 'test',
      results: [],
      pagination: { page: 2, offset: 10, limit: 10, total: 21 },
    });

    expect(response?.pagination?.total).toBe(21);
  });
});
