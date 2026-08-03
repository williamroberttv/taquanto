import { Component, ElementRef, computed, input, output, viewChild } from '@angular/core';
import { Pagination, PriceRecord } from '../../services/taquanto-api';
import { SaleRecordCard } from './sale-record-card';
import { SearchPagination } from './search-pagination';

@Component({
  selector: 'app-search-results',
  imports: [SaleRecordCard, SearchPagination],
  template: `
    <section
      #section
      id="search-results"
      class="mt-8 scroll-mt-20"
      aria-label="Resultados de preços"
      [attr.aria-busy]="loading()"
    >
      <div class="results-list">
        <div
          class="results-heading flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
        >
          <div>
            <p class="eyebrow eyebrow-with-icon">
              Vendas e preços
              <svg class="eyebrow-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20 13 13 20 4 11V4h7Z" />
                <circle cx="8.5" cy="8.5" r="1" />
              </svg>
            </p>
            <div class="mt-2 flex items-center gap-2">
              <h2 class="text-2xl font-bold text-[var(--tq-ink)]">Registros encontrados</h2>
              <span class="tooltip tooltip-left tooltip-primary">
                <button
                  type="button"
                  class="btn btn-circle btn-ghost btn-xs h-7 min-h-7 w-7 p-0 text-primary"
                  aria-label="Como os registros são exibidos"
                  aria-describedby="records-info"
                >
                  <svg
                    class="h-4 w-4 fill-none stroke-current stroke-2"
                    viewBox="0 0 24 24"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9" />
                    <path d="M12 11v5" />
                    <path d="M12 8h.01" />
                  </svg>
                </button>
                <span
                  id="records-info"
                  class="tooltip-content z-10 max-w-xs text-left"
                  role="tooltip"
                >
                  Exibimos registros de venda NFC-e do município e período selecionados. Os valores
                  são históricos, não ofertas, e podem mudar no estabelecimento.
                </span>
              </span>
            </div>
          </div>
          @if (hasResults() && !loading()) {
            <p class="text-sm font-medium text-[var(--tq-muted)]">{{ recordsSummary() }}</p>
          }
        </div>

        @if (cacheMessage()) {
          <p
            class="cache-status mt-3 text-sm font-medium text-[var(--tq-muted)]"
            role="status"
            aria-live="polite"
          >
            <span
              class="cache-status-dot"
              [class.cache-status-dot-pending]="cachePending()"
              aria-hidden="true"
            ></span>
            {{ cacheMessage() }}
          </p>
        }

        @if (loading()) {
          <p class="sr-only" role="status" aria-live="polite">
            {{ loadingAnnouncement() }}
          </p>
          <div
            class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            aria-hidden="true"
          >
            @for (skeleton of skeletons; track skeleton) {
              <div class="card bg-base-100 shadow-sm">
                <div class="card-body gap-2 p-4">
                  <div class="skeleton h-6 w-24"></div>
                  <div class="skeleton h-5 w-4/5"></div>
                  <div class="skeleton h-4 w-3/5"></div>
                  <div class="skeleton h-4 w-full"></div>
                  <div class="skeleton mt-2 h-10 w-32"></div>
                </div>
              </div>
            }
          </div>
        } @else if (hasResults()) {
          <div class="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            @for (record of records(); track $index) {
              <app-sale-record-card
                [record]="record"
                [lowest]="record.sale_value_cents === lowestValueCents()"
                [actions]="actions()"
                [favorite]="isFavorite()(record)"
                (favoriteToggled)="favoriteToggled.emit($event)"
                (detailsRequested)="detailsRequested.emit($event)"
              />
            }
          </div>
        } @else if (emptyMessage()) {
          <p class="results-message empty-results mt-5 text-sm font-medium text-[var(--tq-muted)]">
            {{ emptyMessage() }}
          </p>
        } @else {
          <p class="results-message mt-5 text-sm font-medium text-[var(--tq-muted)]">
            {{ initialMessage() }}
          </p>
        }

        @if (hasResults() && pagination(); as currentPage) {
          <app-search-pagination
            [pagination]="currentPage"
            [loading]="loading()"
            (pageSelected)="pageSelected.emit($event)"
          />
        }
      </div>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .results-heading,
    .results-message,
    .cache-status {
      padding-inline: 1.25rem;
    }

    .cache-status {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .cache-status-dot {
      width: 0.5rem;
      height: 0.5rem;
      flex: none;
      border-radius: 50%;
      background: var(--color-success);
    }

    .cache-status-dot-pending {
      background: var(--color-error);
      animation: cache-status-fade 1.2s ease-in-out infinite;
    }

    @keyframes cache-status-fade {
      50% {
        opacity: 0.25;
      }
    }
  `,
})
export class SearchResults {
  private readonly section = viewChild.required<ElementRef<HTMLElement>>('section');

  readonly records = input.required<PriceRecord[]>();
  readonly pagination = input.required<Pagination | null>();
  readonly loading = input.required<boolean>();
  readonly emptyMessage = input.required<string | null>();
  readonly cacheMessage = input.required<string | null>();
  readonly cachePending = input.required<boolean>();
  readonly kind = input<'product' | 'fuel'>('product');
  readonly actions = input(true);
  readonly isFavorite = input<(record: PriceRecord) => boolean>(() => false);
  readonly favoriteToggled = output<PriceRecord>();
  readonly detailsRequested = output<PriceRecord>();
  readonly pageSelected = output<number>();
  protected readonly skeletons = [1, 2, 3, 4];
  protected readonly initialMessage = computed(() =>
    this.kind() === 'fuel'
      ? 'Consulte um combustível para ver os registros no município e período selecionados.'
      : 'Busque um produto para ver os registros no município e período selecionados.',
  );
  protected readonly loadingAnnouncement = computed(() =>
    this.kind() === 'fuel'
      ? 'Buscando registros de combustível.'
      : 'Buscando preços. Buscas por descrição podem demorar.',
  );
  protected readonly hasResults = computed(() => this.records().length > 0);
  protected readonly lowestValueCents = computed(() =>
    Math.min(...this.records().map((record) => record.sale_value_cents)),
  );
  protected readonly recordsSummary = computed(() => {
    const pagination = this.pagination();
    if (!pagination) {
      return '';
    }
    const offset = (pagination.page - 1) * pagination.page_size;
    return `${offset + 1}-${offset + pagination.page_records} de ${pagination.total_records} registros`;
  });

  scrollIntoView(): void {
    this.section().nativeElement.scrollIntoView?.();
  }
}
