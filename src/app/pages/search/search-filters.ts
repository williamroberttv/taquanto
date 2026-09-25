import { Component, input, output } from '@angular/core';
import { MunicipalitySelect } from '../../components/municipality-select/municipality-select';
import { MunicipalitySelection } from '../../municipalities';
import { SEARCH_PERIODS } from './search.models';

@Component({
  selector: 'app-search-filters',
  imports: [MunicipalitySelect],
  host: { class: 'location-filter' },
  template: `
    <fieldset class="period-filter fieldset">
      <legend class="fieldset-legend">
        Período
        <span class="text-error" aria-hidden="true">*</span>
        <span class="sr-only">(obrigatório)</span>
      </legend>
      <select
        id="search-period"
        class="select select-sm min-h-10 w-full"
        aria-label="Período da consulta"
        name="days"
        required
        [value]="days()"
        (change)="selectPeriod($event)"
      >
        @for (period of periods; track period.days) {
          <option [value]="period.days">{{ period.label }}{{ period.hint }}</option>
        }
      </select>
    </fieldset>

    <app-municipality-select
      [municipality]="municipality()"
      (municipalityChange)="municipalityChange.emit($event)"
    />
  `,
  styles: `
    :host {
      display: contents;
    }

    app-municipality-select {
      min-width: 0;
    }

    .period-filter {
      min-width: 0;
    }

    @media (min-width: 640px) {
      app-municipality-select,
      .period-filter {
        grid-column: span 2;
      }
    }

    @media (min-width: 768px) {
      .period-filter {
        grid-column: span 1;
      }
    }
  `,
})
export class SearchFilters {
  readonly municipality = input.required<MunicipalitySelection>();
  readonly days = input.required<number>();
  readonly municipalityChange = output<MunicipalitySelection>();
  readonly daysChange = output<number>();

  protected readonly periods = SEARCH_PERIODS;

  protected selectPeriod(event: Event): void {
    this.daysChange.emit(Number((event.target as HTMLSelectElement).value));
  }
}
