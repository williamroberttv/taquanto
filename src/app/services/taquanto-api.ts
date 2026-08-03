import { HttpClient } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { map, timeout } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SearchResultData {
  source: string;
  results: PriceRecord[];
  pagination: Pagination;
}

export interface SearchResponse extends SearchResultData {
  query: string;
}

export interface FuelResponse extends SearchResultData {
  type: number;
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
  latitude: number | string | null;
  longitude: number | string | null;
  address: string;
  district: string;
  city: string;
  zip_code: string;
  source: string;
}

interface PageParams {
  days: number;
  limit: number;
  page: number;
}

export interface GeographicSearch {
  latitude: number;
  longitude: number;
  radius: number;
}

export type PricePageParams = PageParams & ({ municipality: string } | GeographicSearch);

export type CacheStatus = 'HIT' | 'STALE' | 'MISS';

export interface CachedSearchResponse {
  data: SearchResultData | null;
  cacheStatus: CacheStatus;
  ageSeconds: number | null;
}

export interface PriceSearchResponse extends CachedSearchResponse {
  data: SearchResponse | null;
}

export interface FuelSearchResponse extends CachedSearchResponse {
  data: FuelResponse | null;
}

@Service()
export class TaquantoApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  private readonly priceTimeoutMs = 5000;

  prices(query: string, pageParams: PricePageParams) {
    return this.cachedSearch<SearchResponse>('prices', {
      days: String(pageParams.days),
      limit: String(pageParams.limit),
      page: String(pageParams.page),
      query,
      ...this.locationParams(pageParams),
    });
  }

  fuels(type: number, pageParams: PricePageParams) {
    return this.cachedSearch<FuelResponse>('fuels', {
      days: String(pageParams.days),
      limit: String(pageParams.limit),
      page: String(pageParams.page),
      type: String(type),
      ...this.locationParams(pageParams),
    });
  }

  private locationParams(pageParams: PricePageParams): Record<string, string> {
    return 'municipality' in pageParams
      ? { municipality: pageParams.municipality }
      : {
          latitude: String(pageParams.latitude),
          longitude: String(pageParams.longitude),
          radius: String(pageParams.radius),
        };
  }

  private cachedSearch<T extends SearchResultData>(
    resource: 'prices' | 'fuels',
    params: Record<string, string>,
  ) {
    return this.http.get<T>(`${this.baseUrl}/v1/${resource}`, { observe: 'response', params }).pipe(
      timeout(this.priceTimeoutMs),
      map((response): CachedSearchResponse & { data: T | null } => {
        const cacheStatus = response.headers.get('X-TaQuanto-Cache-Status');
        const age = response.headers.get('X-TaQuanto-Cache-Age');
        const retryAfter = response.headers.get('X-TaQuanto-Cache-Retry-After');
        const ageSeconds = age !== null && /^\d+$/.test(age) ? Number(age) : null;

        if (
          response.status === 202 &&
          cacheStatus === 'MISS' &&
          retryAfter === '5' &&
          !response.body
        ) {
          return { data: null, cacheStatus, ageSeconds };
        }
        if (response.status === 200 && (cacheStatus === 'HIT' || cacheStatus === 'STALE')) {
          return { data: response.body, cacheStatus, ageSeconds };
        }

        throw new Error(`Invalid ${resource} cache response`);
      }),
    );
  }
}
