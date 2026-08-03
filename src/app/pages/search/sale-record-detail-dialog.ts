import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import {
  formatAddress,
  formatMoney,
  formatSaleTime,
  formatSaleValue,
  formatTitle,
  recordCoordinates,
} from '../../price-record';
import { PriceRecord } from '../../services/taquanto-api';

@Component({
  selector: 'app-sale-record-detail-dialog',
  imports: [FavoriteToggle],
  template: `
    <dialog #dialog class="modal" aria-labelledby="detail-title" (close)="closed.emit()">
      <section class="detail-modal modal-box max-w-5xl">
        <div class="detail-modal-header">
          <div>
            <p class="eyebrow">Detalhe da venda</p>
            <h2 id="detail-title" class="mt-2 text-2xl font-bold text-[var(--tq-ink)]">
              {{ formatTitle(record().description) }}
            </h2>
          </div>
          <div class="flex gap-2">
            <app-favorite-toggle
              [record]="record()"
              [favorite]="favorite()"
              (toggled)="favoriteToggled.emit($event)"
            />
            <button
              type="button"
              class="close-button btn btn-square btn-ghost min-h-11"
              aria-label="Fechar detalhes"
              (click)="dismiss()"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div class="detail-grid">
          <div>
            <p class="detail-label">Valor da venda</p>
            <p class="price-value">{{ formatSaleValue(record()) }}</p>
          </div>
          <div>
            <p class="detail-label">Estabelecimento</p>
            <p class="detail-value">{{ formatTitle(record().store.name) }}</p>
          </div>
          <div>
            <p class="detail-label">Horário da venda</p>
            <time class="detail-value block" [attr.datetime]="record().sold_at">
              {{ formatSaleTime(record()) }}
            </time>
          </div>
          <div>
            <p class="detail-label">GTIN</p>
            <p class="detail-value">{{ record().gtin || 'Não informado' }}</p>
          </div>
          @if (hasDifferentDeclaredValue()) {
            <div>
              <p class="detail-label">Valor declarado</p>
              <p class="detail-value">{{ formatMoney(record().declared_value_cents) }}</p>
            </div>
          }
          <div class="detail-grid-wide">
            <p class="detail-label">Localização</p>
            @if (record().location.address) {
              <p class="detail-value">{{ formatAddress(record().location.address) }}</p>
            } @else {
              <p class="detail-value">Endereço não informado</p>
            }
          </div>
        </div>

        <div class="detail-map-wrap">
          @if (!hasCoordinates()) {
            <p class="map-empty-message">Localização no mapa não informada pela fonte.</p>
          }
          <div
            #mapContainer
            class="detail-map"
            role="region"
            aria-label="Mapa da localização da venda selecionada"
          ></div>
        </div>
      </section>
      <form method="dialog" class="modal-backdrop">
        <button aria-label="Fechar detalhes">Fechar detalhes</button>
      </form>
    </dialog>
  `,
  styles: `
    :host {
      display: block;
    }

    .detail-modal {
      max-height: calc(100dvh - 3rem);
      overflow: hidden;
      padding: 1.25rem;
    }

    .detail-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-top: 14px;
    }

    .detail-map-wrap {
      margin-top: 14px;
    }

    .detail-map {
      height: min(30vh, 240px);
      min-height: 180px;
    }

    @media (max-width: 640px) {
      .detail-modal {
        width: calc(100% - 1.5rem);
        max-height: calc(100dvh - 1.5rem);
        padding: 1rem;
      }

      .detail-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .detail-map {
        height: 22vh;
        min-height: 130px;
      }
    }
  `,
})
export class SaleRecordDetailDialog {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private map?: Leaflet.Map;
  private marker?: Leaflet.CircleMarker;

  readonly record = input.required<PriceRecord>();
  readonly favorite = input.required<boolean>();
  readonly favoriteToggled = output<PriceRecord>();
  readonly closed = output<void>();
  protected readonly formatAddress = formatAddress;
  protected readonly formatMoney = formatMoney;
  protected readonly formatSaleTime = formatSaleTime;
  protected readonly formatSaleValue = formatSaleValue;
  protected readonly formatTitle = formatTitle;
  protected readonly hasDifferentDeclaredValue = computed(
    () => this.record().declared_value_cents !== this.record().sale_value_cents,
  );
  protected readonly hasCoordinates = computed(() => recordCoordinates(this.record()) !== null);

  constructor() {
    afterNextRender(() => {
      if (!isPlatformBrowser(this.platformId)) {
        return;
      }
      this.dialog().nativeElement.showModal?.();
      void this.initializeMap();
    });
    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  protected dismiss(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.close) {
      dialog.close();
    } else {
      this.closed.emit();
    }
  }

  private async initializeMap(): Promise<void> {
    const record = this.record();
    const leaflet = (await import('leaflet')).default;
    const coordinates = recordCoordinates(record);
    const center = coordinates ?? ([-9.653, -35.716] as Leaflet.LatLngExpression);

    this.map = leaflet.map(this.mapContainer().nativeElement, {
      center,
      scrollWheelZoom: true,
      zoom: coordinates ? 16 : 8,
    });
    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);

    if (coordinates) {
      this.marker = leaflet
        .circleMarker(coordinates, {
          className: 'search-sale-marker',
          color: 'var(--tq-card)',
          fillColor: 'var(--color-primary)',
          fillOpacity: 1,
          radius: 10,
          weight: 3,
        })
        .bindPopup(
          '<strong>' +
            this.escapeHtml(record.description) +
            '</strong><br>' +
            this.escapeHtml(formatSaleValue(record)) +
            '<br>' +
            this.escapeHtml(record.store.name),
        )
        .addTo(this.map);
      const markerElement = this.marker.getElement();
      markerElement?.setAttribute('role', 'button');
      markerElement?.setAttribute('tabindex', '0');
      markerElement?.setAttribute(
        'aria-label',
        record.store.name + ' - ' + formatSaleValue(record),
      );
      markerElement?.addEventListener('keydown', (event) => {
        const keyboardEvent = event as KeyboardEvent;
        if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
          event.preventDefault();
          this.marker?.openPopup();
        }
      });
    }
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (char) => {
      switch (char) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }
}
