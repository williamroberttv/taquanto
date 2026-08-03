import { Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-product-search-form',
  template: `
    <form
      #form
      id="product-search"
      tabindex="-1"
      class="card mt-8 grid scroll-mt-20 gap-3 bg-base-100 p-4 shadow-sm sm:grid-cols-[1fr_auto]"
      aria-labelledby="product-search-title"
      (submit)="submit($event)"
    >
      <div class="sm:col-span-2">
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
      <label class="sr-only" for="product-query">Produto ou código de barras</label>
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
          minlength="3"
          maxlength="50"
          [value]="query()"
          (input)="updateQuery($event)"
          class="input min-h-12 w-full bg-base-100 pl-11 text-base"
          placeholder="Ex.: arroz, café 250g ou GTIN"
        />
      </div>
      <button type="submit" class="btn btn-primary min-h-12">
        <svg class="button-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m16 16 4 4" />
        </svg>
        {{ loading() ? 'Buscando...' : 'Buscar' }}
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
  `,
})
export class ProductSearchForm {
  private readonly form = viewChild.required<ElementRef<HTMLFormElement>>('form');

  readonly query = input.required<string>();
  readonly loading = input.required<boolean>();
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
