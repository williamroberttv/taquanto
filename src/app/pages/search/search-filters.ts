import { Component, input, output } from '@angular/core';
import {
  MunicipalityMap,
  MunicipalitySelection,
} from '../../components/municipality-map/municipality-map';
import { SEARCH_PERIODS } from './search.models';

@Component({
  selector: 'app-search-filters',
  imports: [MunicipalityMap],
  template: `
    <section
      class="location-filter card mt-8 bg-base-200 shadow-sm"
      aria-labelledby="location-filter-title"
    >
      <div class="location-filter-heading">
        <p class="eyebrow eyebrow-with-icon">
          Onde e quando procurar
          <svg class="eyebrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
        </p>
        <h2 id="location-filter-title" class="mt-2 text-2xl font-bold text-[var(--tq-ink)]">
          Escolha um município de Alagoas
        </h2>
        <p class="mt-2 text-sm leading-6 text-[var(--tq-muted)]">
          Cada consulta usa um município e o período recente selecionado. Use 24 horas ou GTIN para
          respostas mais rápidas.
        </p>
      </div>

      <app-municipality-map
        [selectedCode]="municipality().code"
        (municipalityChange)="municipalityChange.emit($event)"
        (municipalityReady)="municipalityReady.emit($event)"
      >
        <div class="fieldset period-filter">
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
          <p>O Economiza Alagoas aceita consultas entre 1 e 10 dias.</p>
        </div>
      </app-municipality-map>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .location-filter-heading {
      border-bottom: 1px solid var(--tq-border);
      padding: 1.25rem;
    }

    app-municipality-map {
      display: block;
      padding: 1.25rem;
    }

    .period-filter p {
      margin: 0.625rem 0 0;
      color: var(--tq-muted);
      font-size: 0.75rem;
      line-height: 1.5;
    }
  `,
})
export class SearchFilters {
  readonly municipality = input.required<MunicipalitySelection>();
  readonly days = input.required<number>();
  readonly municipalityChange = output<MunicipalitySelection>();
  readonly municipalityReady = output<MunicipalitySelection>();
  readonly daysChange = output<number>();
  protected readonly periods = SEARCH_PERIODS;

  protected selectPeriod(event: Event): void {
    this.daysChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
