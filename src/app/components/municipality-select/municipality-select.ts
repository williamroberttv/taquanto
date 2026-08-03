import { Component, ElementRef, computed, input, output, signal, viewChild } from '@angular/core';
import { ALAGOAS_MUNICIPALITIES, MunicipalitySelection } from '../../municipalities';

@Component({
  selector: 'app-municipality-select',
  template: `
    <fieldset class="fieldset">
      <legend id="municipality-label" class="fieldset-legend">
        Município
        <span class="text-error" aria-hidden="true">*</span>
        <span class="sr-only">(obrigatório)</span>
      </legend>
      <details #dropdown class="dropdown w-full" (toggle)="toggleDropdown(dropdown.open)">
        <summary
          #trigger
          id="municipality-select"
          class="select select-sm min-h-10 w-full cursor-pointer list-none bg-base-100"
          aria-haspopup="listbox"
          aria-required="true"
          aria-controls="municipality-options"
          aria-labelledby="municipality-label municipality-value"
          [attr.aria-expanded]="open()"
          [attr.data-value]="municipality().code"
        >
          <span id="municipality-value">{{ municipality().name }}</span>
        </summary>

        <div
          class="dropdown-content z-20 mt-2 w-full rounded-box border border-[var(--tq-border)] bg-base-100 p-2 shadow-xl"
        >
          <label class="sr-only" for="municipality-search">Buscar município</label>
          <input
            #searchInput
            id="municipality-search"
            type="search"
            class="input input-sm min-h-10 w-full"
            autocomplete="off"
            placeholder="Buscar município"
            aria-controls="municipality-options"
            [value]="filter()"
            (input)="filterMunicipalities($event)"
            (keydown.escape)="close()"
          />
          <div
            id="municipality-options"
            class="municipality-options mt-2 grid max-h-64 overflow-y-auto"
            role="listbox"
            aria-label="Municípios de Alagoas"
          >
            @for (option of filteredMunicipalities(); track option.code) {
              <button
                type="button"
                class="municipality-option"
                role="option"
                [value]="option.code"
                [attr.aria-selected]="option.code === municipality().code"
                (click)="select(option)"
              >
                {{ option.name }}
              </button>
            } @empty {
              <p
                class="px-3 py-2 text-sm text-[var(--tq-muted)]"
                role="option"
                aria-disabled="true"
                aria-selected="false"
              >
                Nenhum município encontrado
              </p>
            }
          </div>
        </div>
      </details>
    </fieldset>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .municipality-option {
      min-height: 2.75rem;
      border: 0;
      border-radius: var(--radius-field);
      background: transparent;
      color: var(--tq-ink);
      padding: 0.625rem 0.75rem;
      text-align: left;
    }

    .municipality-option:hover,
    .municipality-option:focus-visible,
    .municipality-option[aria-selected='true'] {
      background: var(--color-base-200);
    }

    .municipality-option[aria-selected='true'] {
      color: var(--color-primary);
      font-weight: 700;
    }
  `,
})
export class MunicipalitySelect {
  private readonly dropdown = viewChild.required<ElementRef<HTMLDetailsElement>>('dropdown');
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');

  readonly municipality = input.required<MunicipalitySelection>();
  readonly municipalityChange = output<MunicipalitySelection>();

  protected readonly filter = signal('');
  protected readonly open = signal(false);
  protected readonly filteredMunicipalities = computed(() => {
    const query = this.normalize(this.filter());
    return ALAGOAS_MUNICIPALITIES.filter(({ name }) => this.normalize(name).includes(query));
  });

  protected toggleDropdown(open: boolean): void {
    this.open.set(open);
    if (open) {
      queueMicrotask(() => this.searchInput()?.nativeElement.focus());
    }
  }

  protected filterMunicipalities(event: Event): void {
    this.filter.set((event.target as HTMLInputElement).value);
  }

  protected select(selection: MunicipalitySelection): void {
    this.municipalityChange.emit(selection);
    this.close();
  }

  protected close(): void {
    this.dropdown().nativeElement.open = false;
    this.filter.set('');
    this.trigger().nativeElement.focus();
  }

  private normalize(value: string): string {
    return value.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/\p{M}/gu, '');
  }
}
