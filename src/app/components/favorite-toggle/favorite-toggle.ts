import { Component, computed, input, output } from '@angular/core';
import { PriceRecord } from '../../services/taquanto-api';

@Component({
  selector: 'app-favorite-toggle',
  host: {
    class: 'inline-flex',
  },
  template: `
    <button
      type="button"
      class="favorite-toggle btn btn-square btn-ghost min-h-11 border-0 text-primary shadow-none hover:border-0"
      [attr.aria-pressed]="favorite()"
      [attr.aria-label]="label()"
      (click)="toggled.emit(record())"
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21l7.7-7.5 1.1-1.1a5.5 5.5 0 0 0 0-7.8Z"
        />
      </svg>
    </button>
  `,
  styles: `
    svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }

    [aria-pressed='true'] svg {
      fill: currentColor;
    }
  `,
})
export class FavoriteToggle {
  readonly record = input.required<PriceRecord>();
  readonly favorite = input.required<boolean>();
  readonly toggled = output<PriceRecord>();
  protected readonly label = computed(
    () =>
      `${this.favorite() ? 'Remover' : 'Adicionar'} ${this.record().description} ${this.favorite() ? 'dos' : 'aos'} favoritos`,
  );
}
