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
import { firstValueFrom } from 'rxjs';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { MunicipalityMap } from '../../components/municipality-map/municipality-map';
import { Pagination, PriceRecord, TaquantoApi } from '../../services/taquanto-api';

type ToastType = 'error' | 'warning';

interface ToastMessage {
  type: ToastType;
  text: string;
}

interface RecentSearch {
  query: string;
  searchedAt: number;
}

@Component({
  selector: 'app-search',
  imports: [Header, Footer, MunicipalityMap],
  host: {
    '(document:keydown.escape)': 'closeRecordDetail()',
  },
  templateUrl: './search.html',
  styleUrl: './search.scss',
})
export class SearchPage {
  private readonly api = inject(TaquantoApi);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly detailMapContainer = viewChild<ElementRef<HTMLElement>>('detailMapContainer');
  private readonly detailCloseButton =
    viewChild<ElementRef<HTMLButtonElement>>('detailCloseButton');
  private readonly loadMoreTrigger = viewChild<ElementRef<HTMLElement>>('loadMoreTrigger');

  private readonly defaultMunicipality = '2704302';
  private readonly recentSearchesKey = 'taquanto:recent-searches';
  private readonly pageSize = 50;
  private readonly periodValues = [1, 3, 7, 10];
  private priceRequestId = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private leaflet?: typeof Leaflet;
  private detailMap?: Leaflet.Map;
  private detailMarker?: Leaflet.Marker;
  private loadMoreObserver?: IntersectionObserver;
  private previouslyFocusedElement?: HTMLElement;
  private loadedPriceKey: string | null = null;
  private currentPriceQuery = '';
  private pendingInitialQuery: string | null = null;

  protected readonly query = signal('');
  protected readonly activeQuery = signal('');
  protected readonly municipality = signal(this.defaultMunicipality);
  protected readonly days = signal(7);
  protected readonly filtersReady = signal(false);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly pricesLoading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly inlineMessage = signal<string | null>(null);
  protected readonly toast = signal<ToastMessage | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly recentSearches = signal<RecentSearch[]>([]);

  protected readonly hasResults = computed(() => this.records().length > 0);
  protected readonly hasMoreRecords = computed(() => this.pagination()?.last_page === false);
  protected readonly totalRecords = computed(
    () => this.pagination()?.total_records ?? this.records().length,
  );

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

      this.initializeInfiniteScroll();
      this.recentSearches.set(this.loadRecentSearches());
      const initialQuery = queryParams.get('q')?.trim();
      if (initialQuery) {
        this.query.set(initialQuery);
        this.pendingInitialQuery = initialQuery;
      }
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
    if (!this.filtersReady()) {
      this.pendingInitialQuery = search.query;
      return;
    }
    void this.runSearch(search.query, true);
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
    }
    this.filtersReady.set(true);

    const pendingQuery = this.pendingInitialQuery;
    this.pendingInitialQuery = null;
    if (pendingQuery) {
      void this.runSearch(pendingQuery, changed);
    } else if (changed) {
      this.updateUrl();
    }
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
      this.previouslyFocusedElement =
        document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
      requestAnimationFrame(() => {
        this.detailCloseButton()?.nativeElement.focus();
        void this.initializeDetailMap();
      });
    }
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
    this.previouslyFocusedElement?.focus();
    this.previouslyFocusedElement = undefined;
  }

  protected formatMoney(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(
      cents / 100,
    );
  }

  protected formatSaleValue(record: PriceRecord): string {
    return `${this.formatMoney(record.sale_value_cents)}${record.unit ? ` / ${record.unit}` : ''}`;
  }

  protected formatSaleDate(record: PriceRecord): string {
    const date = new Date(record.sold_at);
    if (Number.isNaN(date.getTime())) {
      return 'Data da venda não informada';
    }
    const formatted = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
      .format(date)
      .replace(', ', ' às ');
    return `Venda em ${formatted}`;
  }

  protected hasDifferentDeclaredValue(record: PriceRecord): boolean {
    return record.declared_value_cents !== record.sale_value_cents;
  }

  protected locationLine(record: PriceRecord): string {
    const parts = [record.location.district, record.location.city, record.location.zip_code].filter(
      Boolean,
    );
    return parts.length ? parts.join(' · ') : 'Localização textual não informada';
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
    this.loadedPriceKey = null;
    this.updateUrl();
    const query = this.activeQuery();
    if (query) {
      void this.loadPrices(query);
    }
  }

  private async runSearch(query: string, updateUrl: boolean): Promise<void> {
    if (!this.isGTIN(query) && (query.length < 3 || query.length > 50)) {
      this.inlineMessage.set('Digite uma descrição de 3 a 50 caracteres ou um GTIN válido.');
      this.showToast('warning', 'Digite uma descrição de 3 a 50 caracteres ou um GTIN válido.');
      return;
    }

    this.query.set(query);
    this.activeQuery.set(query);
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
      if (this.records().length === 0) {
        this.showToast('warning', 'Nenhum registro encontrado para esses filtros.');
      }
    } catch {
      if (requestId === this.priceRequestId) {
        this.inlineMessage.set('Não foi possível buscar preços agora.');
        this.showToast('error', 'Não foi possível buscar preços agora.');
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
        q: this.activeQuery() || null,
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

    const leaflet = this.leaflet ?? (await import('leaflet'));
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
        .marker(coordinates, {
          icon: leaflet.divIcon({
            className: 'search-sale-marker',
            html: '<span></span>',
            iconAnchor: [14, 28],
            iconSize: [28, 28],
            popupAnchor: [0, -26],
          }),
          title: record.store.name + ' - ' + this.formatSaleValue(record),
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
    }
    requestAnimationFrame(() => this.detailMap?.invalidateSize());
  }

  private initializeInfiniteScroll(): void {
    const target = this.loadMoreTrigger()?.nativeElement;
    if (!target || this.loadMoreObserver || typeof IntersectionObserver === 'undefined') {
      return;
    }

    this.loadMoreObserver = new IntersectionObserver(
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
    const { latitude, longitude } = record.location;
    if (
      latitude === null ||
      longitude === null ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      return null;
    }
    return [latitude, longitude];
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

  private showToast(type: ToastType, text: string): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toast.set({ type, text });
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
