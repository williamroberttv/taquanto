import { Component, computed, input, output, signal } from '@angular/core';
import { MunicipalityMap } from '../../components/municipality-map/municipality-map';
import { MunicipalitySelect } from '../../components/municipality-select/municipality-select';
import { MunicipalitySelection } from '../../municipalities';
import { SEARCH_PERIODS } from './search.models';

@Component({
  selector: 'app-search-filters',
  imports: [MunicipalityMap, MunicipalitySelect],
  template: `
    <section class="location-filter card mt-4 bg-base-200 shadow-sm">
      <details open>
        <summary class="filter-summary">
          <span>
            <span class="filter-label">Filtros da consulta</span>
            <span class="filter-values">{{ municipality().name }} · {{ periodLabel() }}</span>
          </span>
          <svg class="filter-chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </summary>

        <div class="filter-panel">
          <div class="filter-fields">
            <app-municipality-select
              [municipality]="municipality()"
              (municipalityChange)="municipalityChange.emit($event)"
            />

            <div class="fieldset">
              <label class="fieldset-legend" for="search-period">Período</label>
              <select
                id="search-period"
                class="select w-full"
                [value]="days()"
                (change)="selectPeriod($event)"
              >
                @for (period of periods; track period.days) {
                  <option [value]="period.days">{{ period.label }}{{ period.hint }}</option>
                }
              </select>
            </div>
          </div>

          @if (productSearch()) {
            <button
              type="button"
              class="map-selector btn btn-outline"
              aria-controls="municipality-map-panel"
              [attr.aria-expanded]="mapVisible()"
              (click)="toggleMap()"
            >
              {{ mapVisible() ? 'Recolher mapa' : 'Selecionar no mapa' }}
            </button>
          }

          @if (mapVisible() || !productSearch()) {
            <div id="municipality-map-panel">
              @defer (when mapVisible() || !productSearch()) {
                <app-municipality-map
                  [selectedCode]="municipality().code"
                  (municipalityChange)="municipalityChange.emit($event)"
                  (municipalityReady)="municipalityReady.emit($event)"
                />
              } @loading {
                <p role="status">Carregando mapa municipal...</p>
              }
            </div>
          }
        </div>
      </details>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .filter-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      padding: 1rem 1.25rem;
      cursor: pointer;
      list-style: none;
    }

    .filter-summary::-webkit-details-marker {
      display: none;
    }

    .filter-label,
    .filter-values {
      display: block;
    }

    .filter-label {
      color: var(--tq-muted);
      font-size: 0.75rem;
      font-weight: 800;
      text-transform: uppercase;
    }

    .filter-values {
      margin-top: 0.25rem;
      font-weight: 700;
    }

    .filter-chevron {
      width: 1.25rem;
      height: 1.25rem;
      flex: none;
      color: var(--color-primary);
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
      transition: transform 200ms ease;
    }

    details[open] .filter-chevron {
      transform: rotate(180deg);
    }

    .filter-panel {
      display: grid;
      gap: 1rem;
      border-top: 1px solid var(--tq-border);
      padding: 1.25rem;
    }

    .filter-fields {
      display: grid;
      gap: 1rem;
    }

    .map-selector {
      justify-self: start;
    }

    @media (min-width: 640px) {
      .filter-fields {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `,
})
export class SearchFilters {
  readonly municipality = input.required<MunicipalitySelection>();
  readonly days = input.required<number>();
  readonly productSearch = input(true);
  readonly municipalityChange = output<MunicipalitySelection>();
  readonly municipalityReady = output<MunicipalitySelection>();
  readonly daysChange = output<number>();

  protected readonly mapVisible = signal(false);
  protected readonly periods = SEARCH_PERIODS;
  protected readonly periodLabel = computed(
    () => this.periods.find((period) => period.days === this.days())?.label ?? '',
  );

  protected selectPeriod(event: Event): void {
    this.daysChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected toggleMap(): void {
    this.mapVisible.update((visible) => !visible);
  }
}
