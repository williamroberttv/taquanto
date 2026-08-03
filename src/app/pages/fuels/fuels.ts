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
import type { MunicipalitySelection } from '../../components/municipality-map/municipality-map';
import { PricePolling } from '../../services/price-polling';
import { CachedSearchResponse, Pagination, PriceRecord } from '../../services/taquanto-api';
import { SearchFilters } from '../search/search-filters';
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
  imports: [Header, Footer, SearchFilters, SearchResults],
  templateUrl: './fuels.html',
  styleUrl: '../search/search.scss',
})
export class FuelsPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly polling = inject(PricePolling);
  private readonly form = viewChild.required<ElementRef<HTMLFormElement>>('fuelForm');
  private readonly resultsSection = viewChild(SearchResults);
  private readonly defaultMunicipality: MunicipalitySelection = {
    code: '2704302',
    name: 'Maceió',
  };
  private readonly pageSize = 50;
  private pollingSubscription: Subscription | null = null;
  private activeSearchKey: string | null = null;
  private loadedSearchKey: string | null = null;
  private searchFromUrl = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly fuelTypes = FUEL_TYPES;
  protected readonly type = signal(1);
  protected readonly municipality = signal(this.defaultMunicipality);
  protected readonly days = signal(1);
  protected readonly filtersReady = signal(false);
  protected readonly records = signal<PriceRecord[]>([]);
  protected readonly pagination = signal<Pagination | null>(null);
  protected readonly loading = signal(false);
  protected readonly emptyMessage = signal<string | null>(null);
  protected readonly cacheMessage = signal<string | null>(null);
  protected readonly cachePending = signal(false);
  protected readonly toast = signal<string | null>(null);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }

      const params = this.route.snapshot.queryParamMap;
      const initialType = Number(params.get('type'));
      const initialMunicipality = params.get('municipality');
      const initialDays = Number(params.get('days'));
      this.searchFromUrl = this.isFuelType(initialType);
      if (this.searchFromUrl) {
        this.type.set(initialType);
      }
      if (this.isMunicipalityCode(initialMunicipality)) {
        this.municipality.set({ code: initialMunicipality, name: '' });
      }
      if (this.isPeriod(initialDays)) {
        this.days.set(initialDays);
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
    if (this.filtersReady()) {
      this.runSearch(true);
    }
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

  protected municipalityReady(selection: MunicipalitySelection): void {
    const changed = selection.code !== this.municipality().code;
    this.municipality.set(selection);
    this.filtersReady.set(true);
    if (changed) {
      this.updateUrl();
    }
    if (this.searchFromUrl) {
      this.searchFromUrl = false;
      this.runSearch(false);
    }
  }

  protected selectPeriod(days: number): void {
    if (!this.isPeriod(days) || days === this.days()) {
      return;
    }
    this.days.set(days);
    this.filtersChanged();
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
    if (updateUrl) {
      this.updateUrl();
    }
    this.requestPage(1);
  }

  private requestPage(page: number): void {
    this.loading.set(true);
    const key = this.searchKey();
    let scrolled = false;
    const subscription = this.polling
      .pollFuel(this.type(), {
        days: this.days(),
        limit: this.pageSize,
        municipality: this.municipality().code,
        page,
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
        municipality: this.municipality().code,
        days: this.days(),
      },
      relativeTo: this.route,
      replaceUrl: true,
    });
  }

  private searchKey(): string {
    return `${this.type()}:${this.municipality().code}:${this.days()}`;
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
}
