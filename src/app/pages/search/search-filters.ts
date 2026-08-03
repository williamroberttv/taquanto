import { Component, computed, input, output, signal } from '@angular/core';
import { MunicipalityMap } from '../../components/municipality-map/municipality-map';
import { ALAGOAS_MUNICIPALITIES, MunicipalitySelection } from '../../municipalities';
import { SEARCH_PERIODS } from './search.models';

@Component({
  selector: 'app-search-filters',
  imports: [MunicipalityMap],
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
            <div class="fieldset">
              <label class="fieldset-legend" for="municipality-select">Município</label>
              <label class="sr-only" for="municipality-search">Buscar município</label>
              <input
                id="municipality-search"
                type="search"
                class="input mb-2 w-full"
                autocomplete="off"
                placeholder="Buscar município"
                aria-controls="municipality-select"
                (input)="filterMunicipalities($event)"
              />
              <select
                id="municipality-select"
                class="select w-full"
                (change)="selectMunicipality($event)"
              >
                <option value="" disabled [selected]="!municipalitySelectValue()">Selecione um município</option>
                @for (option of filteredMunicipalities(); track option.code) {
                  <option
                    [value]="option.code"
                    [selected]="option.code === municipalitySelectValue()"
                  >{{ option.name }}</option>
                }
                @if (filteredMunicipalities().length === 0) {
                  <option disabled>Nenhum município encontrado</option>
                }
              </select>
            </div>

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
              (click)="showMap()"
            >
              {{ mapVisible() ? 'Mapa municipal aberto' : 'Selecionar no mapa' }}
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
  protected readonly municipalityFilter = signal('');
  protected readonly municipalities = ALAGOAS_MUNICIPALITIES;
  protected readonly filteredMunicipalities = computed(() => {
    const query = this.normalize(this.municipalityFilter());
    return this.municipalities.filter(({ name }) => this.normalize(name).includes(query));
  });
  protected readonly municipalitySelectValue = computed(() =>
    this.filteredMunicipalities().some(({ code }) => code === this.municipality().code)
      ? this.municipality().code
      : '',
  );
  protected readonly periods = SEARCH_PERIODS;
  protected readonly periodLabel = computed(
    () => this.periods.find((period) => period.days === this.days())?.label ?? '',
  );

  protected selectMunicipality(event: Event): void {
    const code = (event.target as HTMLSelectElement).value;
    const selection = this.municipalities.find((municipality) => municipality.code === code);
    if (selection) {
      this.municipalityChange.emit(selection);
    }
  }

  protected selectPeriod(event: Event): void {
    this.daysChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected filterMunicipalities(event: Event): void {
    this.municipalityFilter.set((event.target as HTMLInputElement).value);
  }

  protected showMap(): void {
    this.mapVisible.set(true);
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '');
  }
}
