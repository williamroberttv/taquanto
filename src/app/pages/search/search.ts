import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import {
  ALAGOAS_MUNICIPALITIES,
  DEFAULT_MUNICIPALITY,
  MunicipalitySelection,
} from '../../municipalities';
import { Favorites } from '../../services/favorites';
import { PricePolling } from '../../services/price-polling';
import {
  CachedSearchResponse,
  GeographicSearch,
  Pagination,
  PriceRecord,
} from '../../services/taquanto-api';
import { ProductSearchForm } from './product-search-form';
import { RecentSearches } from './recent-searches';
import { SaleRecordDetailDialog } from './sale-record-detail-dialog';
import { SearchFilters } from './search-filters';
import { RecentSearch, SEARCH_PERIODS } from './search.models';
import { SearchResults } from './search-results';

@Component({
  selector: 'app-search',
  imports: [
    Header,
    Footer,
    ProductSearchForm,
    RecentSearches,
    SaleRecordDetailDialog,
    SearchFilters,
    SearchResults,
  ],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly favorites = inject(Favorites);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly pricePolling = inject(PricePolling);
  private readonly filtersSection = viewChild(ProductSearchForm);
  private readonly searchFilters = viewChild(SearchFilters);

  private readonly recentSearchesKey = 'taquanto:recent-searches';
  private readonly pageSize = 50;
  private pricePollingSubscription: Subscription | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private loadedPriceKey: string | null = null;
  private activeSearchKey: string | null = null;
  private currentPriceQuery = '';
  private queryFromUrl: string | null = null;
  private pendingSearch: { query: string; updateUrl: boolean } | null = null;

  protected readonly query = signal('');
  protected readonly municipality = signal(DEFAULT_MUNICIPALITY);
  protected readonly days = signal(1);
  protected readonly location = signal<GeographicSearch | null>(null);
  protected readonly locationPending = signal(false);
  protected readonly filtersVisible = signal(true);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly pricesLoading = signal(false);
  protected readonly inlineMessage = signal<string | null>(null);
  protected readonly emptyMessage = signal<string | null>(null);
  protected readonly cacheMessage = signal<string | null>(null);
  protected readonly cachePending = signal(false);
  protected readonly toast = signal<string | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly recentSearches = signal<RecentSearch[]>([]);
  protected readonly isFavorite = (record: PriceRecord) => this.favorites.has(record);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const filtersSection = this.filtersSection()?.nativeElement;
      if (filtersSection) {
        const observer = new IntersectionObserver(
          ([entry]) =>
            this.filtersVisible.set(entry.isIntersecting || entry.boundingClientRect.top >= 0),
          { threshold: 0.01 },
        );
        observer.observe(filtersSection);
        this.destroyRef.onDestroy(() => observer.disconnect());
      }

      const queryParams = this.route.snapshot.queryParamMap;
      const initialMunicipality = queryParams.get('municipality');
      const initialDays = Number(queryParams.get('days'));
      if (this.isMunicipalityCode(initialMunicipality)) {
        this.municipality.set(
          ALAGOAS_MUNICIPALITIES.find(({ code }) => code === initialMunicipality) ??
            DEFAULT_MUNICIPALITY,
        );
      }
      if (this.isPeriod(initialDays)) {
        this.days.set(initialDays);
      }

      this.recentSearches.set(this.loadRecentSearches());
      this.queryFromUrl = queryParams.get('q')?.trim() || null;
      if (this.queryFromUrl) {
        this.query.set(this.queryFromUrl);
      }
      this.runUrlSearch();
    });

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
      this.cancelPricePolling();
    });
  }

  protected submitSearch(): void {
    const query = this.query().trim();
    const filters = this.searchFilters();
    if (filters && !filters.validateLocationPermission()) {
      this.pendingSearch = { query, updateUrl: true };
      return;
    }
    this.runSearch(query, true);
  }

  protected repeatSearch(search: RecentSearch): void {
    this.cancelPricePolling();
    this.loadedPriceKey = null;
    this.query.set(search.query);
    this.days.set(search.days);
    this.location.set(null);
    this.inlineMessage.set(null);
    if (search.useLocation) {
      this.pendingSearch = { query: search.query, updateUrl: true };
      this.searchFilters()?.requestLocation(search.radius ?? 5);
      return;
    }
    this.municipality.set(search.municipality);
    this.runSearch(search.query, true);
  }

  protected updateQuery(query: string): void {
    if (query !== this.query() && (this.pricePollingSubscription || this.pricesLoading())) {
      this.cancelPricePolling();
      this.loadedPriceKey = null;
    }
    this.query.set(query);
  }

  protected selectMunicipality(selection: MunicipalitySelection): void {
    if (!this.isMunicipalityCode(selection.code)) {
      return;
    }
    const changed = selection.code !== this.municipality().code;
    this.municipality.set(selection);
    if (!changed) {
      return;
    }
    this.filtersChanged();
  }

  protected selectPeriod(days: number): void {
    if (!this.isPeriod(days) || days === this.days()) {
      return;
    }
    this.days.set(days);
    this.filtersChanged();
  }

  protected selectLocation(location: GeographicSearch | null): void {
    if (!location) {
      this.pendingSearch = null;
    }
    if (this.sameLocation(location, this.location())) {
      this.resumePendingSearch(location);
      return;
    }
    this.location.set(location);
    this.filtersChanged();
    this.resumePendingSearch(location);
  }

  protected loadPage(page: number): void {
    const pagination = this.pagination();
    if (
      !pagination ||
      this.pricesLoading() ||
      page === pagination.page ||
      page < 1 ||
      page > pagination.total_pages
    ) {
      return;
    }
    this.cancelPricePolling();
    this.requestPricePage(this.currentPriceQuery, page);
  }

  protected scrollToFilters(): void {
    this.filtersSection()?.scrollIntoView();
    this.filtersVisible.set(true);
  }

  protected openRecordDetail(record: PriceRecord): void {
    this.selectedRecord.set(record);
  }

  protected toggleFavorite(record: PriceRecord): void {
    if (
      !this.favorites.toggle(record, {
        query: this.currentPriceQuery,
        municipality: this.municipality(),
        days: this.days(),
      })
    ) {
      this.showToast('Não foi possível atualizar os favoritos.');
    }
  }

  protected closeRecordDetail(): void {
    this.selectedRecord.set(null);
  }

  private runUrlSearch(): void {
    if (!this.queryFromUrl) {
      return;
    }
    const query = this.queryFromUrl;
    this.queryFromUrl = null;
    this.runSearch(query, false);
  }

  private filtersChanged(): void {
    this.cancelPricePolling();
    this.loadedPriceKey = null;
    this.records.set([]);
    this.pagination.set(null);
    this.inlineMessage.set(null);
    this.emptyMessage.set(null);
    this.pricesLoading.set(false);
    this.updateUrl();
  }

  private runSearch(query: string, updateUrl: boolean): void {
    if (!this.isGTIN(query) && (query.length < 3 || query.length > 50)) {
      this.emptyMessage.set(null);
      this.inlineMessage.set('Digite uma descrição de 3 a 50 caracteres ou um GTIN válido.');
      return;
    }
    const searchKey = this.priceKey(query);
    if (searchKey === this.activeSearchKey || searchKey === this.loadedPriceKey) {
      return;
    }

    this.cancelPricePolling();
    this.activeSearchKey = searchKey;
    this.query.set(query);
    this.inlineMessage.set(null);
    this.emptyMessage.set(null);
    this.records.set([]);
    this.pagination.set(null);
    this.loadedPriceKey = null;
    this.saveRecentSearch(query);

    if (updateUrl) {
      this.updateUrl();
    }
    this.loadPrices(query);
  }

  private loadPrices(query: string): void {
    const key = this.priceKey(query);
    if (this.loadedPriceKey === key) {
      return;
    }

    this.currentPriceQuery = query;
    this.pagination.set(null);
    this.records.set([]);
    this.requestPricePage(query, 1);
  }

  private requestPricePage(query: string, page: number): void {
    this.pricesLoading.set(true);
    const searchKey = this.priceKey(query);
    const location = this.location();
    const subscription = this.pricePolling
      .poll(query, {
        days: this.days(),
        limit: this.pageSize,
        page,
        ...(location ?? { municipality: this.municipality().code }),
      })
      .subscribe({
        next: (event) => {
          if (event.kind === 'exhausted') {
            if (!this.pagination()) {
              this.loadedPriceKey = null;
            }
            this.cacheMessage.set(this.revalidationFailureMessage());
            this.cachePending.set(true);
            this.pricesLoading.set(false);
            return;
          }
          const { response } = event;
          if (response.cacheStatus !== 'MISS') {
            this.loadedPriceKey = searchKey;
            this.applyPriceData(response);
            this.pricesLoading.set(false);
          }
          if (response.cacheStatus === 'HIT') {
            this.cacheMessage.set(event.revalidation ? 'Resultados atualizados.' : null);
            this.cachePending.set(false);
            this.pricesLoading.set(false);
          } else {
            this.cacheMessage.set(
              this.pagination()
                ? 'Exibindo dados em cache enquanto atualizamos.'
                : 'Buscando dados atualizados.',
            );
            this.cachePending.set(true);
          }
        },
        error: () => {
          this.activeSearchKey = null;
          this.pricePollingSubscription = null;
          this.pricesLoading.set(false);
          if (this.pagination()) {
            this.cacheMessage.set(this.revalidationFailureMessage());
            this.cachePending.set(true);
          } else {
            this.cacheMessage.set(null);
            this.inlineMessage.set(null);
            this.showToast('Não foi possível concluir a busca. Tente novamente em instantes.');
          }
        },
        complete: () => {
          this.activeSearchKey = null;
          this.pricePollingSubscription = null;
        },
      });
    this.pricePollingSubscription = subscription.closed ? null : subscription;
  }

  private applyPriceData(response: CachedSearchResponse): void {
    this.records.set(response.data?.results ?? []);
    this.pagination.set(response.data?.pagination ?? null);
    this.emptyMessage.set(
      this.records().length ? null : 'Nenhum registro encontrado para esses filtros.',
    );
  }

  private revalidationFailureMessage(): string {
    return this.pagination()
      ? 'Não foi possível atualizar agora; exibindo dados em cache.'
      : 'Não foi possível obter dados atualizados. Tente buscar novamente.';
  }

  private cancelPricePolling(): void {
    this.pricePollingSubscription?.unsubscribe();
    this.pricePollingSubscription = null;
    this.activeSearchKey = null;
    this.cacheMessage.set(null);
    this.cachePending.set(false);
    this.pricesLoading.set(false);
  }

  private updateUrl(): void {
    void this.router.navigate([], {
      queryParams: {
        q: this.query().trim() || null,
        municipality: this.location() ? null : this.municipality().code,
        days: this.days(),
      },
      relativeTo: this.route,
      replaceUrl: true,
    });
  }

  private priceKey(query: string): string {
    const location = this.location();
    const place = location
      ? `${location.latitude}:${location.longitude}:${location.radius}`
      : this.municipality().code;
    return `${query}:${place}:${this.days()}`;
  }

  private isGTIN(query: string): boolean {
    return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(query);
  }

  private isMunicipalityCode(code: unknown): code is string {
    return typeof code === 'string' && /^\d{7}$/.test(code);
  }

  private isPeriod(days: number): boolean {
    return SEARCH_PERIODS.some((period) => period.days === days);
  }

  private showToast(text: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast.set(text);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
  }

  private loadRecentSearches(): RecentSearch[] {
    try {
      const parsed = JSON.parse(localStorage.getItem(this.recentSearchesKey) ?? '[]') as unknown;
      if (!Array.isArray(parsed)) {
        return [];
      }
      return parsed
        .filter((item): item is RecentSearch => {
          if (!item || typeof item !== 'object') {
            return false;
          }
          const search = item as Record<string, unknown>;
          const municipality = search['municipality'];
          const useLocation = search['useLocation'];
          const radius = search['radius'];
          return (
            typeof search['query'] === 'string' &&
            typeof search['days'] === 'number' &&
            this.isPeriod(search['days']) &&
            !!municipality &&
            typeof municipality === 'object' &&
            this.isMunicipalityCode((municipality as Record<string, unknown>)['code']) &&
            typeof (municipality as Record<string, unknown>)['name'] === 'string' &&
            (useLocation === undefined || typeof useLocation === 'boolean') &&
            (useLocation !== true || this.isRadius(radius))
          );
        })
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  private saveRecentSearch(query: string): void {
    const location = this.location();
    const search: RecentSearch = {
      query,
      municipality: this.municipality(),
      days: this.days(),
      ...(location ? { useLocation: true, radius: location.radius } : {}),
    };
    const searchKey = this.recentSearchKey(search);
    const searches = [
      search,
      ...this.recentSearches().filter((item) => this.recentSearchKey(item) !== searchKey),
    ].slice(0, 10);
    this.recentSearches.set(searches);

    try {
      localStorage.setItem(this.recentSearchesKey, JSON.stringify(searches));
    } catch {
      // localStorage can be unavailable in private or restricted browser contexts.
    }
  }

  private recentSearchKey(search: RecentSearch): string {
    const place = search.useLocation ? `nearby:${search.radius}` : search.municipality.code;
    return `${search.query.toLowerCase()}:${place}:${search.days}`;
  }

  private isRadius(radius: unknown): radius is number {
    return radius === 5 || radius === 10 || radius === 15;
  }

  private resumePendingSearch(location: GeographicSearch | null): void {
    if (!location || !this.pendingSearch) {
      return;
    }
    const pending = this.pendingSearch;
    this.pendingSearch = null;
    this.runSearch(pending.query, pending.updateUrl);
  }

  private sameLocation(first: GeographicSearch | null, second: GeographicSearch | null): boolean {
    return (
      first === second ||
      (!!first &&
        !!second &&
        first.latitude === second.latitude &&
        first.longitude === second.longitude &&
        first.radius === second.radius)
    );
  }
}
