import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
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
  type MunicipalitySelection,
} from '../../municipalities';
import { PricePolling } from '../../services/price-polling';
import { Favorites } from '../../services/favorites';
import { Analytics } from '../../services/analytics';
import {
  CachedSearchResponse,
  GeographicSearch,
  Pagination,
  PriceRecord,
} from '../../services/taquanto-api';
import { SearchFilters } from '../search/search-filters';
import { SaleRecordDetailDialog } from '../search/sale-record-detail-dialog';
import { SEARCH_PERIODS } from '../search/search.models';
import { SearchResults } from '../search/search-results';

const FUEL_TYPES = [
  { id: 1, label: 'Gasolina comum' },
  { id: 2, label: 'Gasolina aditivada' },
  { id: 3, label: 'Álcool' },
  { id: 4, label: 'Diesel comum' },
  { id: 5, label: 'Diesel aditivado / S10' },
  { id: 6, label: 'GNV' },
] as const;

@Component({
  selector: 'app-fuels',
  imports: [Header, Footer, SearchFilters, SearchResults, SaleRecordDetailDialog],
  templateUrl: './fuels.html',
  styleUrl: '../search/search.scss',
})
export class FuelsPage {
  private readonly analytics = inject(Analytics);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly polling = inject(PricePolling);
  private readonly favorites = inject(Favorites);
  private readonly form = viewChild.required<ElementRef<HTMLFormElement>>('fuelForm');
  private readonly searchFilters = viewChild(SearchFilters);
  private readonly resultsSection = viewChild(SearchResults);
  private readonly pageSize = 50;
  private pollingSubscription: Subscription | null = null;
  private activeSearchKey: string | null = null;
  private loadedSearchKey: string | null = null;
  private searchFromUrl = false;
  private pendingSearch = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly fuelTypes = FUEL_TYPES;
  protected readonly type = signal(1);
  protected readonly municipality = signal(DEFAULT_MUNICIPALITY);
  protected readonly days = signal(1);
  protected readonly location = signal<GeographicSearch | null>(null);
  protected readonly locationPending = signal(false);
  protected readonly filtersVisible = signal(true);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly loading = signal(false);
  protected readonly emptyMessage = signal<string | null>(null);
  protected readonly cacheMessage = signal<string | null>(null);
  protected readonly cachePending = signal(false);
  protected readonly toast = signal<string | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly isFavorite = (record: PriceRecord): boolean => this.favorites.has(record);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const form = this.form().nativeElement;
      const observer = new IntersectionObserver(
        ([entry]) =>
          this.filtersVisible.set(entry.isIntersecting || entry.boundingClientRect.top >= 0),
        { threshold: 0.01 },
      );
      observer.observe(form);
      this.destroyRef.onDestroy(() => observer.disconnect());

      const params = this.route.snapshot.queryParamMap;
      const initialType = Number(params.get('type'));
      const initialMunicipality = params.get('municipality');
      const initialDays = Number(params.get('days'));
      this.searchFromUrl = this.isFuelType(initialType);
      if (this.searchFromUrl) {
        this.type.set(initialType);
      }
      if (this.isMunicipalityCode(initialMunicipality)) {
        this.municipality.set(
          ALAGOAS_MUNICIPALITIES.find(({ code }) => code === initialMunicipality) ??
            DEFAULT_MUNICIPALITY,
        );
      }
      if (this.isPeriod(initialDays)) {
        this.days.set(initialDays);
      }
      if (this.searchFromUrl) {
        this.searchFromUrl = false;
        this.runSearch(false);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.cancelPolling();
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
    });
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    const filters = this.searchFilters();
    if (filters && !filters.validateLocationPermission()) {
      this.pendingSearch = true;
      return;
    }
    this.runSearch(true);
  }

  protected selectType(event: Event): void {
    const type = Number((event.target as HTMLSelectElement).value);
    if (!this.isFuelType(type) || type === this.type()) {
      return;
    }
    this.type.set(type);
    this.filtersChanged();
  }

  protected selectMunicipality(selection: MunicipalitySelection): void {
    if (!this.isMunicipalityCode(selection.code)) {
      return;
    }
    const changed = selection.code !== this.municipality().code;
    this.municipality.set(selection);
    if (changed) {
      this.filtersChanged();
    }
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
      this.pendingSearch = false;
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
      this.loading() ||
      page === pagination.page ||
      page < 1 ||
      page > pagination.total_pages
    ) {
      return;
    }
    this.cancelPolling();
    this.requestPage(page);
  }

  protected scrollToForm(): void {
    this.form().nativeElement.scrollIntoView();
    this.form().nativeElement.focus({ preventScroll: true });
    this.filtersVisible.set(true);
  }

  protected toggleFavorite(record: PriceRecord): void {
    const wasFavorite = this.favorites.has(record);
    if (!this.favorites.toggle(record)) {
      this.showToast('Não foi possível atualizar os favoritos.');
      return;
    }
    this.analytics.capture(wasFavorite ? 'favorite_removed' : 'favorite_added', {
      search_type: 'fuel',
    });
  }

  protected openRecordDetail(record: PriceRecord): void {
    this.selectedRecord.set(record);
    this.analytics.capture('result_detail_opened', { search_type: 'fuel' });
  }

  protected closeRecordDetail(): void {
    this.selectedRecord.set(null);
  }

  private filtersChanged(): void {
    this.cancelPolling();
    this.loadedSearchKey = null;
    this.records.set([]);
    this.pagination.set(null);
    this.emptyMessage.set(null);
    this.updateUrl();
  }

  private runSearch(updateUrl: boolean): void {
    const key = this.searchKey();
    if (key === this.activeSearchKey || key === this.loadedSearchKey) {
      return;
    }
    this.cancelPolling();
    this.activeSearchKey = key;
    this.loadedSearchKey = null;
    this.records.set([]);
    this.pagination.set(null);
    this.emptyMessage.set(null);
    const location = this.location();
    this.analytics.capture('search_submitted', {
      search_type: 'fuel',
      fuel: FUEL_TYPES.find(({ id }) => id === this.type())?.label,
      fuel_id: this.type(),
      days: this.days(),
      location_mode: location ? 'nearby' : 'municipality',
      ...(location ? { radius: location.radius } : { municipality: this.municipality().name }),
    });
    if (updateUrl) {
      this.updateUrl();
    }
    this.requestPage(1);
  }

  private requestPage(page: number): void {
    this.loading.set(true);
    const key = this.searchKey();
    let scrolled = false;
    const location = this.location();
    const subscription = this.polling
      .pollFuel(this.type(), {
        days: this.days(),
        limit: this.pageSize,
        page,
        ...(location ?? { municipality: this.municipality().code }),
      })
      .subscribe({
        next: (event) => {
          if (event.kind === 'exhausted') {
            if (!this.pagination()) {
              this.loadedSearchKey = null;
            }
            this.cacheMessage.set(this.revalidationFailureMessage());
            this.cachePending.set(true);
            this.loading.set(false);
            return;
          }
          if (event.response.cacheStatus !== 'MISS') {
            if (page === 1 && this.loadedSearchKey !== key) {
              this.analytics.capture('search_results_loaded', {
                search_type: 'fuel',
                fuel_id: this.type(),
                result_count: event.response.data?.pagination.total_records ?? 0,
                days: this.days(),
                location_mode: location ? 'nearby' : 'municipality',
                ...(location
                  ? { radius: location.radius }
                  : { municipality: this.municipality().name }),
              });
            }
            this.loadedSearchKey = key;
            this.applyData(event.response);
            if (!scrolled) {
              scrolled = true;
              this.resultsSection()?.scrollIntoView();
            }
            this.loading.set(false);
          }
          if (event.response.cacheStatus === 'HIT') {
            this.cacheMessage.set(event.revalidation ? 'Resultados atualizados.' : null);
            this.cachePending.set(false);
            this.loading.set(false);
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
          this.pollingSubscription = null;
          this.loading.set(false);
          if (this.pagination()) {
            this.cacheMessage.set(this.revalidationFailureMessage());
            this.cachePending.set(true);
          } else {
            this.cacheMessage.set(null);
            this.showToast('Não foi possível concluir a consulta. Tente novamente em instantes.');
          }
        },
        complete: () => {
          this.activeSearchKey = null;
          this.pollingSubscription = null;
        },
      });
    this.pollingSubscription = subscription.closed ? null : subscription;
  }

  private applyData(response: CachedSearchResponse): void {
    this.records.set(response.data?.results ?? []);
    this.pagination.set(response.data?.pagination ?? null);
    this.emptyMessage.set(
      this.records().length ? null : 'Nenhum registro encontrado para esses filtros.',
    );
  }

  private cancelPolling(): void {
    this.pollingSubscription?.unsubscribe();
    this.pollingSubscription = null;
    this.activeSearchKey = null;
    this.cacheMessage.set(null);
    this.cachePending.set(false);
    this.loading.set(false);
  }

  private updateUrl(): void {
    void this.router.navigate([], {
      queryParams: {
        type: this.type(),
        municipality: this.location() ? null : this.municipality().code,
        days: this.days(),
      },
      relativeTo: this.route,
      replaceUrl: true,
    });
  }

  private searchKey(): string {
    const location = this.location();
    const place = location
      ? `${location.latitude}:${location.longitude}:${location.radius}`
      : this.municipality().code;
    return `${this.type()}:${place}:${this.days()}`;
  }

  private revalidationFailureMessage(): string {
    return this.pagination()
      ? 'Não foi possível atualizar agora; exibindo dados em cache.'
      : 'Não foi possível obter dados atualizados. Tente consultar novamente.';
  }

  private isFuelType(type: number): boolean {
    return FUEL_TYPES.some((fuel) => fuel.id === type);
  }

  private isMunicipalityCode(code: unknown): code is string {
    return typeof code === 'string' && /^\d{7}$/.test(code);
  }

  private isPeriod(days: number): boolean {
    return SEARCH_PERIODS.some((period) => period.days === days);
  }

  private showToast(message: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast.set(message);
    this.toastTimer = setTimeout(() => this.toast.set(null), 4500);
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

  private resumePendingSearch(location: GeographicSearch | null): void {
    if (!location || !this.pendingSearch) {
      return;
    }
    this.pendingSearch = false;
    this.runSearch(true);
  }
}
