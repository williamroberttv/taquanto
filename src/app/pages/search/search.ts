import { isPlatformBrowser } from '@angular/common';
import {
  afterRenderEffect,
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
import { firstValueFrom } from 'rxjs';
import { Footer } from '../../components/footer/footer';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import { Header } from '../../components/header/header';
import { MunicipalityMap } from '../../components/municipality-map/municipality-map';
import {
  formatMoney,
  formatSaleDate,
  formatSaleValue,
  locationLine,
  recordCoordinates,
} from '../../price-record';
import { Favorites } from '../../services/favorites';
import { Pagination, PriceRecord, TaquantoApi } from '../../services/taquanto-api';

interface RecentSearch {
  query: string;
  searchedAt: number;
}

@Component({
  selector: 'app-search',
  imports: [Header, Footer, MunicipalityMap, FavoriteToggle],
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private readonly api = inject(TaquantoApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly favorites = inject(Favorites);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detailMapContainer = viewChild<ElementRef<HTMLElement>>('detailMapContainer');
  private readonly detailDialog = viewChild<ElementRef<HTMLDialogElement>>('detailDialog');
  private readonly loadMoreTrigger = viewChild<ElementRef<HTMLElement>>('loadMoreTrigger');

  private readonly defaultMunicipality = '2704302';
  private readonly recentSearchesKey = 'taquanto:recent-searches';
  private readonly pageSize = 50;
  private readonly periodValues = [1, 3, 7, 10];
  private priceRequestId = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private leaflet?: typeof Leaflet;
  private detailMap?: Leaflet.Map;
  private detailMarker?: Leaflet.CircleMarker;
  private loadMoreObserver?: IntersectionObserver;
  private observedLoadMoreTrigger?: HTMLElement;
  private observedLoadMorePage?: number;
  private loadedPriceKey: string | null = null;
  private currentPriceQuery = '';

  protected readonly query = signal('');
  protected readonly municipality = signal(this.defaultMunicipality);
  protected readonly days = signal(1);
  protected readonly filtersReady = signal(false);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly pricesLoading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly inlineMessage = signal<string | null>(null);
  protected readonly toast = signal<string | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly recentSearches = signal<RecentSearch[]>([]);

  protected readonly hasResults = computed(() => this.records().length > 0);
  protected readonly hasMoreRecords = computed(() => this.pagination()?.last_page === false);
  protected readonly totalRecords = computed(
    () => this.pagination()?.total_records ?? this.records().length,
  );
  protected readonly formatMoney = formatMoney;
  protected readonly formatSaleDate = formatSaleDate;
  protected readonly formatSaleValue = formatSaleValue;
  protected readonly locationLine = locationLine;

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const queryParams = this.route.snapshot.queryParamMap;
      const initialMunicipality = queryParams.get('municipality');
      const initialDays = Number(queryParams.get('days'));
      if (this.isMunicipalityCode(initialMunicipality)) {
        this.municipality.set(initialMunicipality);
      }
      if (this.periodValues.includes(initialDays)) {
        this.days.set(initialDays);
      }

      this.recentSearches.set(this.loadRecentSearches());
      const initialQuery = queryParams.get('q')?.trim();
      if (initialQuery) {
        this.query.set(initialQuery);
      }
    });

    afterRenderEffect({
      read: () => this.initializeInfiniteScroll(),
    });

    this.destroyRef.onDestroy(() => {
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
      }
      this.loadMoreObserver?.disconnect();
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
    this.inlineMessage.set(null);
  }

  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected selectMunicipality(code: string): void {
    if (!this.isMunicipalityCode(code) || code === this.municipality()) {
      return;
    }
    this.municipality.set(code);
    this.filtersChanged();
  }

  protected selectPeriod(event: Event): void {
    const days = Number((event.target as HTMLSelectElement).value);
    if (!this.periodValues.includes(days) || days === this.days()) {
      return;
    }
    this.days.set(days);
    this.filtersChanged();
  }

  protected municipalityMapReady(code: string): void {
    const changed = code !== this.municipality();
    if (changed) {
      this.municipality.set(code);
      this.updateUrl();
    }
    this.filtersReady.set(true);
  }

  protected async loadNextPage(): Promise<void> {
    const pagination = this.pagination();
    if (!pagination || this.pricesLoading() || this.loadingMore() || !this.hasMoreRecords()) {
      return;
    }
    await this.requestPricePage(
      this.currentPriceQuery,
      pagination.page + 1,
      this.priceRequestId,
      true,
    );
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
    if (!this.favorites.toggle(record)) {
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
    const dateTime = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
    }).format(new Date(search.searchedAt));

    if (diffMs < minuteMs) {
      return 'agora · ' + dateTime;
    }
    if (diffMs < hourMs) {
      const minutes = Math.floor(diffMs / minuteMs);
      return 'há ' + minutes + ' ' + (minutes === 1 ? 'minuto' : 'minutos') + ' · ' + dateTime;
    }
    if (diffMs < dayMs) {
      const hours = Math.floor(diffMs / hourMs);
      return 'há ' + hours + ' ' + (hours === 1 ? 'hora' : 'horas') + ' · ' + dateTime;
    }
    if (diffMs < 2 * dayMs) {
      return 'ontem · ' + dateTime;
    }
    const days = Math.floor(diffMs / dayMs);
    return 'há ' + days + ' dias · ' + dateTime;
  }

  private filtersChanged(): void {
    this.priceRequestId += 1;
    this.loadedPriceKey = null;
    this.records.set([]);
    this.pagination.set(null);
    this.inlineMessage.set(null);
    this.pricesLoading.set(false);
    this.loadingMore.set(false);
    this.updateUrl();
  }

  private async runSearch(query: string, updateUrl: boolean): Promise<void> {
    if (!this.isGTIN(query) && (query.length < 3 || query.length > 50)) {
      this.inlineMessage.set('Digite uma descrição de 3 a 50 caracteres ou um GTIN válido.');
      return;
    }

    this.query.set(query);
    this.inlineMessage.set(null);
    this.records.set([]);
    this.pagination.set(null);
    this.loadedPriceKey = null;
    this.priceRequestId += 1;
    this.saveRecentSearch(query);

    if (updateUrl) {
      this.updateUrl();
    }
    await this.loadPrices(query);
  }

  private async loadPrices(query: string): Promise<void> {
    const key = this.priceKey(query);
    if (this.loadedPriceKey === key) {
      return;
    }

    const requestId = this.priceRequestId + 1;
    this.priceRequestId = requestId;
    this.currentPriceQuery = query;
    this.pagination.set(null);
    this.records.set([]);
    await this.requestPricePage(query, 1, requestId, false);
  }

  private async requestPricePage(
    query: string,
    page: number,
    requestId: number,
    append: boolean,
  ): Promise<void> {
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.pricesLoading.set(true);
    }

    try {
      const response = await firstValueFrom(
        this.api.prices(query, {
          days: this.days(),
          limit: this.pageSize,
          municipality: this.municipality(),
          page,
        }),
      );
      if (requestId !== this.priceRequestId) {
        return;
      }

      this.records.set(append ? [...this.records(), ...response.results] : response.results);
      this.pagination.set(response.pagination);
      this.loadedPriceKey = this.priceKey(query);
      this.inlineMessage.set(
        this.records().length ? null : 'Nenhum registro encontrado para esses filtros.',
      );
    } catch {
      if (requestId === this.priceRequestId) {
        this.inlineMessage.set(null);
        this.showToast('Não foi possível concluir a busca. Tente novamente em instantes.');
      }
    } finally {
      if (requestId === this.priceRequestId) {
        this.pricesLoading.set(false);
        this.loadingMore.set(false);
      }
    }
  }

  private updateUrl(): void {
    void this.router.navigate([], {
      queryParams: {
        q: this.query().trim() || null,
        municipality: this.municipality(),
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

  private initializeInfiniteScroll(): void {
    const target = this.loadMoreTrigger()?.nativeElement;
    const page = this.pagination()?.page;
    if (target === this.observedLoadMoreTrigger && page === this.observedLoadMorePage) {
      return;
    }

    this.loadMoreObserver?.disconnect();
    this.observedLoadMoreTrigger = target;
    this.observedLoadMorePage = page;
    if (!target || typeof IntersectionObserver === 'undefined') {
      return;
    }
    this.loadMoreObserver ??= new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void this.loadNextPage();
        }
      },
      { rootMargin: '420px' },
    );
    this.loadMoreObserver.observe(target);
  }

  private coordinates(record: PriceRecord): Leaflet.LatLngExpression | null {
    return recordCoordinates(record);
  }

  private priceKey(query: string): string {
    return `${query}:${this.municipality()}:${this.days()}`;
  }

  private isGTIN(query: string): boolean {
    return /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(query);
  }

  private isMunicipalityCode(code: string | null): code is string {
    return /^\d{7}$/.test(code ?? '');
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
          return typeof search['query'] === 'string' && typeof search['searchedAt'] === 'number';
        })
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  private saveRecentSearch(query: string): void {
    const search: RecentSearch = { query, searchedAt: Date.now() };
    const searches = [
      search,
      ...this.recentSearches().filter((item) => item.query.toLowerCase() !== query.toLowerCase()),
    ].slice(0, 10);
    this.recentSearches.set(searches);

    try {
      localStorage.setItem(this.recentSearchesKey, JSON.stringify(searches));
    } catch {
      // localStorage can be unavailable in private or restricted browser contexts.
    }
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
