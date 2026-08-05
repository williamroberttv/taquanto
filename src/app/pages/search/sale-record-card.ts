import { Component, computed, input, output } from '@angular/core';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import {
  formatAddress,
  formatSaleTime,
  formatSaleValue,
  formatTitle,
  recordCoordinates,
} from '../../price-record';
import { PriceRecord } from '../../services/taquanto-api';

@Component({
  selector: 'app-sale-record-card',
  imports: [FavoriteToggle],
  template: `
    <article class="price-card card bg-base-100 shadow-sm">
      @if (lowest()) {
        <span
          class="lowest-price-tag tooltip tooltip-left"
          data-tip="Menor valor entre os registros desta página"
          role="img"
          aria-label="Menor valor entre os registros desta página"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M20 13 13 20 4 11V4h7Z" />
            <circle cx="8.5" cy="8.5" r="1" />
          </svg>
        </span>
      }
      <div class="card-body h-full gap-0 p-5">
        <p class="card-price-slot price-value">{{ formatSaleValue(record()) }}</p>
        <div
          class="card-title-tooltip tooltip tooltip-bottom"
          [attr.data-tip]="formatTitle(record().description)"
        >
          <h3 class="card-title-slot text-base font-semibold leading-snug text-[var(--tq-ink)]">
            {{ formatTitle(record().description) }}
          </h3>
        </div>
        <div class="card-store-slot">
          <p class="card-store-name">{{ formatTitle(record().store.name) }}</p>
        </div>
        <div class="card-location-slot">
          @if (record().location.address) {
            <p
              class="card-secondary tooltip tooltip-bottom"
              [attr.data-tip]="formatAddress(record().location.address)"
            >
              {{ formatAddress(record().location.address) }}
            </p>
          } @else {
            <p class="card-secondary">Endereço não informado</p>
          }
        </div>
        <time class="card-time-slot card-secondary" [attr.datetime]="record().sold_at">
          {{ formatSaleTime(record()) }}
        </time>
        @if (actions()) {
          <div class="card-actions mt-auto justify-start gap-1 pt-1">
            <app-favorite-toggle
              [record]="record()"
              [favorite]="favorite()"
              (toggled)="favoriteToggled.emit($event)"
            />
            <span
              class="tooltip tooltip-top"
              [attr.data-tip]="hasCoordinates() ? 'Mostrar no mapa' : 'Localização indisponível'"
            >
              <button
                type="button"
                class="map-record-button btn btn-square btn-ghost h-10 min-h-10 w-10 p-0"
                [disabled]="!hasCoordinates()"
                [style.color]="
                  hasCoordinates() ? 'var(--color-primary)' : 'var(--tq-muted)'
                "
                [attr.aria-label]="
                  hasCoordinates() ? 'Mostrar venda no mapa' : 'Localização indisponível'
                "
                (click)="locationRequested.emit(record())"
              >
                <svg
                  class="h-5 w-5"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" />
                  <circle cx="12" cy="10" r="2.5" />
                </svg>
              </button>
            </span>
            <button
              type="button"
              class="detail-button btn btn-outline btn-primary h-10 min-h-10 px-3 text-sm"
              (click)="detailsRequested.emit(record())"
            >
              Detalhes
              <svg
                class="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-width="2"
                aria-hidden="true"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        }
      </div>
    </article>
  `,
  styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .lowest-price-tag {
      position: absolute;
      top: 12px;
      right: 12px;
      z-index: 2;
      display: grid;
      width: 32px;
      height: 32px;
      place-items: center;
      border-radius: 999px;
      background: var(--color-success);
      color: var(--color-success-content);
    }

    .lowest-price-tag svg {
      width: 17px;
      height: 17px;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
      stroke-width: 2;
    }
  `,
})
export class SaleRecordCard {
  readonly record = input.required<PriceRecord>();
  readonly lowest = input.required<boolean>();
  readonly favorite = input(false);
  readonly actions = input(true);
  readonly favoriteToggled = output<PriceRecord>();
  readonly detailsRequested = output<PriceRecord>();
  readonly locationRequested = output<PriceRecord>();
  protected readonly hasCoordinates = computed(() => recordCoordinates(this.record()) !== null);
  protected readonly formatAddress = formatAddress;
  protected readonly formatSaleTime = formatSaleTime;
  protected readonly formatSaleValue = formatSaleValue;
  protected readonly formatTitle = formatTitle;
}
