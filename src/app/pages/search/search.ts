import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import type * as Leaflet from 'leaflet';
import { Subscription } from 'rxjs';
import { Footer } from '../../components/footer/footer';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import { Header } from '../../components/header/header';
import {
  MunicipalityMap,
  type MunicipalitySelection,
} from '../../components/municipality-map/municipality-map';
import {
  formatAddress,
  formatMoney,
  formatSaleTime,
  formatSaleValue,
  formatTitle,
  recordCoordinates,
} from '../../price-record';
import { Favorites } from '../../services/favorites';
import { PricePolling } from '../../services/price-polling';
import { Pagination, PriceRecord, PriceSearchResponse } from '../../services/taquanto-api';

interface RecentSearch {
  query: string;
  municipality: MunicipalitySelection;
  days: number;
  searchedAt: number;
}

@Component({
  selector: 'app-search',
  imports: [Header, Footer, MunicipalityMap, FavoriteToggle],
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
  private readonly detailMapContainer = viewChild<ElementRef<HTMLElement>>('detailMapContainer');
  private readonly detailDialog = viewChild<ElementRef<HTMLDialogElement>>('detailDialog');
  private readonly filtersSection = viewChild<ElementRef<HTMLElement>>('filtersSection');
  private readonly resultsSection = viewChild<ElementRef<HTMLElement>>('resultsSection');

  private readonly defaultMunicipality: MunicipalitySelection = {
    code: '2704302',
    name: 'Maceió',
  };
  private readonly recentSearchesKey = 'taquanto:recent-searches';
  private readonly pageSize = 50;
  private pricePollingSubscription: Subscription | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private leaflet?: typeof Leaflet;
  private detailMap?: Leaflet.Map;
  private detailMarker?: Leaflet.CircleMarker;
  private loadedPriceKey: string | null = null;
  private activeSearchKey: string | null = null;
  private currentPriceQuery = '';
  private queryFromUrl: string | null = null;

  protected readonly query = signal('');
  protected readonly municipality = signal(this.defaultMunicipality);
  protected readonly periods = [
    { days: 1, label: 'Últimas 24 horas', hint: ' (mais rápido)' },
    { days: 3, label: 'Últimos 3 dias', hint: '' },
    { days: 7, label: '1 semana', hint: '' },
    { days: 10, label: 'Últimos 10 dias', hint: '' },
  ] as const;
  protected readonly days = signal(1);
  protected readonly filtersVisible = signal(true);
  protected readonly filtersReady = signal(false);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly pricesLoading = signal(false);
  protected readonly inlineMessage = signal<string | null>(null);
  protected readonly cacheMessage = signal<string | null>(null);
  protected readonly toast = signal<string | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly recentSearches = signal<RecentSearch[]>([]);
  protected readonly skeletons = [1, 2, 3, 4];

  protected readonly hasResults = computed(() => this.records().length > 0);
  protected readonly recordsSummary = computed(() => {
    const pagination = this.pagination();
    if (!pagination) {
      return '';
    }

    const offset = (pagination.page - 1) * pagination.page_size;
    return `${offset + 1}-${offset + pagination.page_records} de ${pagination.total_records} registros`;
  });
  protected readonly pageNumbers = computed(() => {
    const pagination = this.pagination();
    if (!pagination) {
      return [];
    }

    const count = Math.min(pagination.total_pages, 3);
    const start = Math.min(
      Math.max(1, pagination.page - 1),
      Math.max(1, pagination.total_pages - count + 1),
    );
    return Array.from({ length: count }, (_, index) => start + index);
  });
  protected readonly formatAddress = formatAddress;
  protected readonly formatMoney = formatMoney;
  protected readonly formatSaleTime = formatSaleTime;
  protected readonly formatSaleValue = formatSaleValue;
  protected readonly formatTitle = formatTitle;

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
        this.municipality.set({ code: initialMunicipality, name: '' });
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
      this.detailMap?.remove();
    });
  }

  protected submitSearch(event: SubmitEvent): void {
    event.preventDefault();
    if (!this.filtersReady()) {
      return;
    }
    void this.runSearch(this.query().trim(), true);
  }

  protected repeatSearch(search: RecentSearch): void {
    this.query.set(search.query);
    this.municipality.set(search.municipality);
    this.days.set(search.days);
    this.inlineMessage.set(null);
    void this.runSearch(search.query, true);
  }

  protected updateQuery(event: Event): void {
    const query = (event.target as HTMLInputElement).value;
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

  protected selectPeriod(event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    if (!this.isPeriod(days) || days === this.days()) {
      return;
    }
    this.days.set(days);
    this.filtersChanged();
  }

  protected municipalityMapReady(selection: MunicipalitySelection): void {
    const changed = selection.code !== this.municipality().code;
    this.municipality.set(selection);
    if (changed) {
      this.updateUrl();
    }
    this.filtersReady.set(true);
    this.runUrlSearch();
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
    const filtersSection = this.filtersSection()?.nativeElement;
    filtersSection?.scrollIntoView();
    filtersSection?.focus({ preventScroll: true });
    this.filtersVisible.set(true);
  }

  protected openRecordDetail(record: PriceRecord): void {
    this.selectedRecord.set(record);
    if (isPlatformBrowser(this.platformId)) {
      requestAnimationFrame(() => {
        this.detailDialog()?.nativeElement.showModal?.();
        void this.initializeDetailMap();
      });
    }
  }

  protected isFavorite(record: PriceRecord): boolean {
    return this.favorites.has(record);
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

  protected dismissRecordDetail(): void {
    this.detailDialog()?.nativeElement.close?.();
  }

  protected closeRecordDetail(): void {
    if (!this.selectedRecord()) {
      return;
    }

    this.selectedRecord.set(null);
    this.detailMarker?.remove();
    this.detailMap?.remove();
    this.detailMarker = undefined;
    this.detailMap = undefined;
  }

  protected hasDifferentDeclaredValue(record: PriceRecord): boolean {
    return record.declared_value_cents !== record.sale_value_cents;
  }

  protected hasCoordinates(record: PriceRecord): boolean {
    return this.coordinates(record) !== null;
  }

  protected formatRecentSearchTime(search: RecentSearch): string {
    const diffMs = Date.now() - search.searchedAt;
    const minuteMs = 60 * 1000;
    const hourMs = 60 * minuteMs;
    const dayMs = 24 * hourMs;

    if (diffMs < minuteMs) {
      return 'Agora';
    }
    if (diffMs < hourMs) {
      const minutes = Math.floor(diffMs / minuteMs);
      return 'há ' + minutes + ' ' + (minutes === 1 ? 'minuto' : 'minutos');
    }
    if (diffMs < dayMs) {
      const hours = Math.floor(diffMs / hourMs);
      return 'há ' + hours + ' ' + (hours === 1 ? 'hora' : 'horas');
    }
    if (diffMs < 2 * dayMs) {
      return 'ontem';
    }
    const days = Math.floor(diffMs / dayMs);
    return 'há ' + days + ' dias';
  }

  protected formatRecentSearchPeriod(days: number): string {
    return this.periods.find((period) => period.days === days)?.label ?? '';
  }

  private runUrlSearch(): void {
    if (!this.filtersReady() || !this.queryFromUrl) {
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
    this.pricesLoading.set(false);
    this.updateUrl();
  }

  private runSearch(query: string, updateUrl: boolean): void {
    if (!this.isGTIN(query) && (query.length < 3 || query.length > 50)) {
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
    let scrolledToResults = false;
    const subscription = this.pricePolling
      .poll(query, {
        days: this.days(),
        limit: this.pageSize,
        municipality: this.municipality().code,
        page,
      })
      .subscribe({
        next: (event) => {
          if (event.kind === 'exhausted') {
            if (!this.pagination()) {
              this.loadedPriceKey = null;
            }
            this.cacheMessage.set(this.revalidationFailureMessage());
            this.pricesLoading.set(false);
            return;
          }
          const { response } = event;
          if (response.data) {
            this.loadedPriceKey = searchKey;
            this.applyPriceData(response);
            if (!scrolledToResults) {
              scrolledToResults = true;
              this.scrollToResults();
            }
            this.pricesLoading.set(false);
          }
          if (response.cacheStatus === 'HIT') {
            this.cacheMessage.set(event.revalidation ? 'Resultados atualizados.' : null);
            this.pricesLoading.set(false);
          } else {
            this.cacheMessage.set(
              this.pagination()
                ? 'Exibindo dados em cache enquanto atualizamos.'
                : 'Buscando dados atualizados.',
            );
          }
        },
        error: () => {
          this.activeSearchKey = null;
          this.pricePollingSubscription = null;
          this.pricesLoading.set(false);
          if (this.pagination()) {
            this.cacheMessage.set(this.revalidationFailureMessage());
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

  private applyPriceData(response: PriceSearchResponse): void {
    if (!response.data) {
      return;
    }
    this.records.set(response.data.results);
    this.pagination.set(response.data.pagination);
    this.inlineMessage.set(
      this.records().length ? null : 'Nenhum registro encontrado para esses filtros.',
    );
  }

  private scrollToResults(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.resultsSection()?.nativeElement.scrollIntoView?.();
    }
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
    this.pricesLoading.set(false);
  }

  private updateUrl(): void {
    void this.router.navigate([], {
      queryParams: {
        q: this.query().trim() || null,
        municipality: this.municipality().code,
        days: this.days(),
      },
      relativeTo: this.route,
      replaceUrl: true,
    });
  }

  private async initializeDetailMap(): Promise<void> {
    const container = this.detailMapContainer()?.nativeElement;
    const record = this.selectedRecord();
    if (!container || !record) {
      return;
    }

    const leaflet = this.leaflet ?? (await import('leaflet')).default;
    this.leaflet = leaflet;
    const coordinates = this.coordinates(record);
    const center = coordinates ?? ([-9.653, -35.716] as Leaflet.LatLngExpression);

    this.detailMap = leaflet.map(container, {
      center,
      scrollWheelZoom: true,
      zoom: coordinates ? 16 : 8,
    });
    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.detailMap);

    if (coordinates) {
      this.detailMarker = leaflet
        .circleMarker(coordinates, {
          className: 'search-sale-marker',
          color: 'var(--tq-card)',
          fillColor: 'var(--color-primary)',
          fillOpacity: 1,
          radius: 10,
          weight: 3,
        })
        .bindPopup(
          '<strong>' +
            this.escapeHtml(record.description) +
            '</strong><br>' +
            this.escapeHtml(this.formatSaleValue(record)) +
            '<br>' +
            this.escapeHtml(record.store.name),
        )
        .addTo(this.detailMap);
      const markerElement = this.detailMarker.getElement();
      markerElement?.setAttribute('role', 'button');
      markerElement?.setAttribute(
        'aria-label',
        record.store.name + ' - ' + this.formatSaleValue(record),
      );
      markerElement?.addEventListener('keydown', (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          event.preventDefault();
          this.detailMarker?.openPopup();
        }
      });
    }
    requestAnimationFrame(() => this.detailMap?.invalidateSize());
  }

  private coordinates(record: PriceRecord): Leaflet.LatLngExpression | null {
    return recordCoordinates(record);
  }

  private priceKey(query: string): string {
    return `${query}:${this.municipality().code}:${this.days()}`;
  }

  private isGTIN(query: string): boolean {
    return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(query);
  }

  private isMunicipalityCode(code: unknown): code is string {
    return typeof code === 'string' && /^\d{7}$/.test(code);
  }

  private isPeriod(days: number): boolean {
    return this.periods.some((period) => period.days === days);
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
          return (
            typeof search['query'] === 'string' &&
            typeof search['searchedAt'] === 'number' &&
            typeof search['days'] === 'number' &&
            this.isPeriod(search['days']) &&
            !!municipality &&
            typeof municipality === 'object' &&
            this.isMunicipalityCode((municipality as Record<string, unknown>)['code']) &&
            typeof (municipality as Record<string, unknown>)['name'] === 'string'
          );
        })
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  private saveRecentSearch(query: string): void {
    const search: RecentSearch = {
      query,
      municipality: this.municipality(),
      days: this.days(),
      searchedAt: Date.now(),
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
    return `${search.query.toLowerCase()}:${search.municipality.code}:${search.days}`;
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }
}
