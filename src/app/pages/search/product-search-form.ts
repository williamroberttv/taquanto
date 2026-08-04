import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-product-search-form',
  template: `
    <form
      #form
      id="product-search"
      tabindex="-1"
      class="search-form card mt-8 grid scroll-mt-20 gap-3 bg-transparent p-4"
      aria-labelledby="product-search-title"
      (submit)="submit($event)"
    >
      <div class="form-heading">
        <p class="eyebrow eyebrow-with-icon">
          O que procurar
          <svg class="eyebrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
        </p>
        <h2 id="product-search-title" class="mt-2 text-2xl font-bold text-[var(--tq-ink)]">
          Digite o produto que deseja buscar
        </h2>
        <p class="mt-2 text-sm leading-6 text-[var(--tq-muted)]">
          Use exemplos como “café torrado e moído 250 g” ou “arroz parboilizado 1 kg”. Quanto mais
          descritiva for a busca, melhor será a resposta.
        </p>
      </div>
      <fieldset class="query-field fieldset">
        <legend class="fieldset-legend">
          Produto ou código de barras
          <span class="text-error" aria-hidden="true">*</span>
          <span class="sr-only">(obrigatório)</span>
        </legend>
        <div class="search-input-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m16 16 4 4" />
          </svg>
          <input
            id="product-query"
            type="search"
            inputmode="search"
            autocomplete="off"
            name="query"
            required
            minlength="3"
            maxlength="50"
            [value]="query()"
            (input)="updateQuery($event)"
            class="input input-sm min-h-10 w-full bg-base-100 pl-10"
            placeholder="Ex.: arroz, café 250g ou GTIN"
          />
        </div>
      </fieldset>

      <ng-content />

      <button
        type="submit"
        class="search-submit btn btn-primary btn-sm min-h-10 self-end"
        [disabled]="locationPending()"
      >
        <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 4 4" />
        </svg>
        {{ locationPending() ? 'Obtendo localização...' : loading() ? 'Buscando...' : 'Buscar' }}
      </button>
    </form>

    @if (message()) {
      <p class="mt-3 text-sm font-semibold text-warning" role="status">{{ message() }}</p>
    }
  `,
  styles: `
    :host {
      display: block;
    }

    .search-form {
      grid-template-columns: minmax(0, 1fr);
      align-items: end;
    }

    .form-heading {
      grid-column: 1 / -1;
    }

    .query-field {
      min-width: 0;
    }

    .search-submit {
      width: 100%;
    }

    .search-input-wrap {
      position: relative;
    }

    .button-icon,
    .search-icon {
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }

    .button-icon {
      width: 18px;
      height: 18px;
    }

    .search-icon {
      position: absolute;
      top: 50%;
      left: 14px;
      z-index: 1;
      width: 20px;
      height: 20px;
      color: var(--color-primary);
      transform: translateY(-50%);
    }

    @media (min-width: 640px) {
      .search-form {
        grid-template-columns: repeat(4, minmax(0, 1fr));
      }

      .query-field {
        grid-column: span 2;
      }
    }

    @media (min-width: 768px) {
      .search-form {
        grid-template-columns: repeat(6, minmax(0, 1fr));
      }
    }
  `,
})
export class ProductSearchForm {
  private readonly form = viewChild.required<ElementRef<HTMLFormElement>>('form');

  readonly query = input.required<string>();
  readonly loading = input.required<boolean>();
  readonly locationPending = input(false);
  readonly message = input.required<string | null>();
  readonly queryChange = output<string>();
  readonly searchSubmitted = output<void>();

  get nativeElement(): HTMLFormElement {
    return this.form().nativeElement;
  }

  scrollIntoView(): void {
    this.nativeElement.scrollIntoView();
    this.nativeElement.focus({ preventScroll: true });
  }

  protected submit(event: SubmitEvent): void {
    event.preventDefault();
    this.searchSubmitted.emit();
  }

  protected updateQuery(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }
}
