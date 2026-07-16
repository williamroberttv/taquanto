import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, PLATFORM_ID, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import type * as Leaflet from 'leaflet';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { CategoryCandidate, Pagination, PriceRecord, TaquantoApi } from '../../services/taquanto-api';

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
  imports: [Header, Footer],
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
  private readonly detailCloseButton = viewChild<ElementRef<HTMLButtonElement>>('detailCloseButton');
  private readonly loadMoreTrigger = viewChild<ElementRef<HTMLElement>>('loadMoreTrigger');

  private readonly recentSearchesKey = 'taquanto:recent-searches';
  private readonly pageSize = 10;
  private categoryRequestId = 0;
  private priceRequestId = 0;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private leaflet?: typeof Leaflet;
  private detailMap?: Leaflet.Map;
  private detailMarker?: Leaflet.Marker;
  private loadMoreObserver?: IntersectionObserver;
  private previouslyFocusedElement?: HTMLElement;
  private loadedPriceKey: string | null = null;
  private currentPriceQuery = '';
  private currentPriceCategory: string | undefined;

  protected readonly query = signal('');
  protected readonly activeQuery = signal('');
  protected readonly categories = signal<CategoryCandidate[]>([]);
  protected readonly categoriesSearched = signal(false);
  protected readonly directPriceSearch = signal(false);
  protected readonly selectedCategory = signal<string | null>(null);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly searchLoading = signal(false);
  protected readonly pricesLoading = signal(false);
  protected readonly loadingMore = signal(false);
  protected readonly loadingPriceKey = signal<string | null>(null);
  protected readonly inlineMessage = signal<string | null>(null);
  protected readonly toast = signal<ToastMessage | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly recentSearches = signal<RecentSearch[]>([]);

  protected readonly hasResults = computed(() => this.records().length > 0);
  protected readonly hasMoreRecords = computed(() => {
    const pagination = this.pagination();
    return pagination ? pagination.offset + pagination.limit < pagination.total : false;
  });
  protected readonly totalRecords = computed(() => this.pagination()?.total ?? this.records().length);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      this.initializeInfiniteScroll();
      this.recentSearches.set(this.loadRecentSearches());
      const initialQuery = this.route.snapshot.queryParamMap.get('q')?.trim();
      if (initialQuery) {
        this.query.set(initialQuery);
        void this.runSearch(initialQuery, false);
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
    const normalizedQuery = this.query().trim();

    void this.runSearch(normalizedQuery, true);
  }

  protected repeatSearch(search: RecentSearch): void {
    this.query.set(search.query);
    void this.runSearch(search.query, true);
  }

  protected updateQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected async selectCategory(category: CategoryCandidate): Promise<void> {
    const query = this.activeQuery();
    const key = this.priceKey(query, category.source_sku);

    if (!query || this.loadingPriceKey() === key || (this.loadedPriceKey === key && this.selectedCategory() === category.source_sku)) {
      return;
    }

    this.selectedCategory.set(category.source_sku);
    await this.loadPrices(query, category.source_sku);
  }

  protected async loadNextPage(): Promise<void> {
    const pagination = this.pagination();

    if (!pagination || this.pricesLoading() || this.loadingMore() || !this.hasMoreRecords()) {
      return;
    }

    await this.requestPricePage(this.currentPriceQuery, this.currentPriceCategory, pagination.page + 1, this.priceRequestId, true);
  }

  protected openRecordDetail(record: PriceRecord): void {
    this.selectedRecord.set(record);
    if (isPlatformBrowser(this.platformId)) {
      this.previouslyFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : undefined;
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

  protected categoryInitials(name: string): string {
    const words = name.split(/[/\s]+/).filter(Boolean);
    return words
      .slice(0, 2)
      .map((word) => word[0]?.toUpperCase() ?? '')
      .join('');
  }

  protected formatMoney(cents: number): string {
    return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(cents / 100);
  }

  protected formatUnitPrice(record: PriceRecord): string {
    return `${this.formatMoney(record.unit_price_cents)}${record.unit ? ` / ${record.unit}` : ''}`;
  }

  protected formatLastSale(record: PriceRecord): string {
    const price = record.last_sale_cents > 0 ? this.formatMoney(record.last_sale_cents) : null;
    const age = record.last_sale_age ?? record.sold_at;

    if (price && age) {
      return `Última venda ${price} · ${age}`;
    }

    if (price) {
      return `Última venda ${price}`;
    }

    return age ? `Última venda ${age}` : 'Última venda não informada';
  }

  protected locationLine(record: PriceRecord): string {
    const parts = [record.location.district, record.location.city, record.location.zip_code].filter(Boolean);
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
    const date = new Date(search.searchedAt);
    const dateTime = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(date);

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

  private async runSearch(query: string, updateUrl: boolean): Promise<void> {
    if (query.length < 3 || query.length > 30) {
      this.inlineMessage.set('Digite entre 3 e 30 caracteres para buscar.');
      this.showToast('warning', 'Digite entre 3 e 30 caracteres para buscar.');
      return;
    }

    this.query.set(query);
    this.activeQuery.set(query);
    this.inlineMessage.set(null);
    this.categories.set([]);
    this.records.set([]);
    this.pagination.set(null);
    this.categoriesSearched.set(true);
    this.directPriceSearch.set(this.isBarcode(query));
    this.selectedCategory.set(null);
    this.loadedPriceKey = null;
    this.currentPriceQuery = '';
    this.currentPriceCategory = undefined;
    this.loadingPriceKey.set(null);
    this.categoryRequestId += 1;
    this.priceRequestId += 1;
    this.saveRecentSearch(query);

    if (updateUrl) {
      void this.router.navigate([], {
        queryParams: { q: query },
        relativeTo: this.route,
        replaceUrl: true,
      });
    }

    if (this.isBarcode(query)) {
      await this.loadPrices(query);
      return;
    }

    await this.loadCategories(query, this.categoryRequestId);
  }

  private async loadCategories(query: string, requestId: number): Promise<void> {
    this.searchLoading.set(true);

    try {
      const response = await firstValueFrom(this.api.categories(query));
      if (requestId !== this.categoryRequestId) {
        return;
      }

      const categories = response.categories ?? [];
      this.categories.set(categories);

      if (categories.length === 0) {
        await this.loadPrices(query);
      }
    } catch {
      if (requestId === this.categoryRequestId) {
        this.inlineMessage.set('Não foi possível buscar categorias agora.');
        this.showToast('error', 'Não foi possível buscar categorias agora.');
      }
    } finally {
      if (requestId === this.categoryRequestId) {
        this.searchLoading.set(false);
      }
    }
  }

  private async loadPrices(query: string, category?: string): Promise<void> {
    const key = this.priceKey(query, category);

    if (this.loadingPriceKey() === key || this.loadedPriceKey === key) {
      return;
    }

    const requestId = this.priceRequestId + 1;
    this.priceRequestId = requestId;
    this.currentPriceQuery = query;
    this.currentPriceCategory = category;
    this.loadingPriceKey.set(key);
    this.pagination.set(null);
    this.records.set([]);

    await this.requestPricePage(query, category, 1, requestId, false);
  }

  private async requestPricePage(query: string, category: string | undefined, page: number, requestId: number, append: boolean): Promise<void> {
    if (append) {
      this.loadingMore.set(true);
    } else {
      this.pricesLoading.set(true);
    }

    try {
      const response = await firstValueFrom(this.api.prices(query, { category, limit: this.pageSize, page }));
      if (requestId !== this.priceRequestId) {
        return;
      }

      const records = response.results ?? [];
      this.records.set(append ? [...this.records(), ...records] : records);
      this.pagination.set(response.pagination ?? null);
      this.loadedPriceKey = this.priceKey(query, category);
      this.inlineMessage.set(this.records().length ? null : 'Nenhum registro encontrado.');

      if (this.records().length === 0) {
        this.showToast('warning', 'Nenhum registro encontrado.');
      }
    } catch {
      if (requestId === this.priceRequestId) {
        this.inlineMessage.set('Não foi possível buscar preços agora.');
        this.showToast('error', 'Não foi possível buscar preços agora.');
      }
    } finally {
      if (requestId === this.priceRequestId) {
        this.loadingPriceKey.set(null);
        this.pricesLoading.set(false);
        this.loadingMore.set(false);
      }
    }
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

    if (!this.detailMap) {
      this.detailMap = leaflet.map(container, {
        center,
        zoom: coordinates ? 16 : 8,
        scrollWheelZoom: true,
      });
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; OpenStreetMap contributors',
          maxZoom: 19,
        })
        .addTo(this.detailMap);
    }

    this.detailMarker?.remove();
    this.detailMarker = undefined;
    this.detailMap.setView(center, coordinates ? 16 : 8);

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
          title: record.store.name + ' - ' + this.formatUnitPrice(record),
        })
        .bindPopup('<strong>' + this.escapeHtml(record.description) + '</strong><br>' + this.escapeHtml(this.formatUnitPrice(record)) + '<br>' + this.escapeHtml(record.store.name))
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
    const parsedLatitude = this.coordinate(latitude);
    const parsedLongitude = this.coordinate(longitude);

    if (parsedLatitude === null || parsedLongitude === null) {
      return null;
    }

    return [parsedLatitude, parsedLongitude];
  }

  private coordinate(value: number | string | null): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (typeof value !== 'string' || !value.trim()) {
      return null;
    }

    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  private priceKey(query: string, category?: string): string {
    return `${query}:${category ?? ''}`;
  }

  private isBarcode(query: string): boolean {
    return /^\d{8,14}$/.test(query);
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
    const searches = [search, ...this.recentSearches().filter((item) => item.query.toLowerCase() !== query.toLowerCase())].slice(0, 10);

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
