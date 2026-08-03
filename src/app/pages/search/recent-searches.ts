import { Component, input, output } from '@angular/core';
import { formatTitle } from '../../price-record';
import { RecentSearch, SEARCH_PERIODS } from './search.models';

@Component({
  selector: 'app-recent-searches',
  template: `
    @if (searches().length > 0) {
      <section class="recent-searches" aria-labelledby="recent-searches-title">
        <h2 id="recent-searches-title" class="recent-searches-title eyebrow eyebrow-with-icon">
          <span>Suas últimas pesquisas</span>
          <svg class="eyebrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
        </h2>
        <div class="recent-search-list">
          @for (search of searches(); track search; let last = $last) {
            <button type="button" class="recent-search-link" (click)="searchSelected.emit(search)">
              {{ formatTitle(search.query) }} - {{ search.municipality.name }} -
              {{ periodLabel(search.days) }}
            </button>
            @if (!last) {
              <span aria-hidden="true">, </span>
            }
          }
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .recent-searches {
      margin-top: 24px;
    }

    .recent-search-list {
      max-height: 7.5rem;
      margin-top: 10px;
      overflow: hidden;
      color: var(--tq-ink);
      font-size: 0.8rem;
      font-weight: 700;
      line-height: 1.5rem;
    }

    .recent-search-link {
      display: inline;
      border: 0;
      background: none;
      padding: 0;
      color: inherit;
      cursor: pointer;
      font: inherit;
    }

    .recent-search-link:hover,
    .recent-search-link:focus-visible {
      color: var(--color-primary);
      text-decoration: underline;
      text-underline-offset: 0.15rem;
    }
  `,
})
export class RecentSearches {
  readonly searches = input.required<RecentSearch[]>();
  readonly searchSelected = output<RecentSearch>();
  protected readonly formatTitle = formatTitle;

  protected periodLabel(days: number): string {
    return SEARCH_PERIODS.find((period) => period.days === days)?.label ?? '';
  }
}
