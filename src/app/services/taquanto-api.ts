import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface SearchResponse {
  query: string;
  source: string;
  results: PriceRecord[];
  categories?: CategoryCandidate[];
  pagination?: Pagination;
}

export interface Pagination {
  page: number;
  offset: number;
  limit: number;
  total: number;
}

export interface CategoryCandidate {
  source_sku: string;
  name: string;
  count: number;
}

export interface PriceRecord {
  description: string;
  barcode: string | null;
  source_sku: string | null;
  unit_price_cents: number;
  unit: string | null;
  last_sale_cents: number;
  last_sale_age: string | null;
  sold_at: string | null;
  store: Store;
  location: Location;
}

export interface Store {
  name: string;
  source_id: string | null;
}

export interface Location {
  latitude: number | string | null;
  longitude: number | string | null;
  address: string | null;
  district: string | null;
  city: string | null;
  zip_code: string | null;
  source: string;
}

export interface PricePageParams {
  category?: string;
  limit: number;
  page: number;
}

@Service()
export class TaquantoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  categories(query: string) {
    return this.http.get<SearchResponse>(`${this.baseUrl}/categories`, {
      params: { query },
    });
  }

  prices(query: string, pageParams: PricePageParams) {
    const params: Record<string, string> = {
      limit: String(pageParams.limit),
      page: String(pageParams.page),
      query,
    };

    if (pageParams.category) {
      params['category'] = pageParams.category;
    }

    return this.http.get<SearchResponse>(`${this.baseUrl}/prices`, { params });
  }
}
