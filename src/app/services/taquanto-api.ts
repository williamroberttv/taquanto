import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { environment } from '../../environments/environment';

export interface SearchResponse {
  query: string;
  source: string;
  results: PriceRecord[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  page_size: number;
  page_records: number;
  total_records: number;
  total_pages: number;
  first_page: boolean;
  last_page: boolean;
}

export interface PriceRecord {
  description: string;
  gtin: string;
  source_product_code: string;
  declared_value_cents: number;
  sale_value_cents: number;
  unit: string;
  sold_at: string;
  store: Store;
  location: Location;
}

export interface Store {
  name: string;
  cnpj: string;
}

export interface Location {
  latitude: number | null;
  longitude: number | null;
  address: string;
  district: string;
  city: string;
  zip_code: string;
  source: string;
}

export interface PricePageParams {
  municipality: string;
  days: number;
  limit: number;
  page: number;
}

@Service()
export class TaquantoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  prices(query: string, pageParams: PricePageParams) {
    return this.http.get<SearchResponse>(`${this.baseUrl}/prices`, {
      params: {
        days: String(pageParams.days),
        limit: String(pageParams.limit),
        municipality: pageParams.municipality,
        page: String(pageParams.page),
        query,
      },
    });
  }
}
