import { isPlatformBrowser } from '@angular/common';
import {
  afterNextRender,
  afterRenderEffect,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import {
  formatAddress,
  formatSaleTime,
  formatSaleValue,
  formatTitle,
  recordCoordinates,
} from '../../../price-record';
import { GeographicSearch, PriceRecord } from '../../../services/taquanto-api';

@Component({
  selector: 'app-search-results-map',
  template: `
    <section class="results-map-wrap" aria-labelledby="results-map-title">
      <h3 id="results-map-title" class="sr-only">Mapa dos registros encontrados</h3>
      <div
        #mapContainer
        class="results-map"
        role="region"
        aria-label="Mapa dos registros encontrados"
      ></div>
      <p class="mt-2 text-xs text-[var(--tq-muted)]">
        {{ mappedRecords() }} de {{ records().length }} registros exibidos no mapa.
      </p>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .results-map-wrap {
      margin-top: 1.25rem;
      overflow: hidden;
      border: 1px solid var(--tq-border);
      border-radius: var(--radius-box);
      background: var(--tq-surface);
      padding: 0.5rem 0.5rem 0.625rem;
    }

    .results-map {
      height: clamp(18rem, 42vw, 28rem);
      border-radius: calc(var(--radius-box) - 0.15rem);
    }

    p {
      padding-inline: 0.25rem;
    }
  `,
})
export class SearchResultsMap {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapContainer = viewChild.required<ElementRef<HTMLElement>>('mapContainer');
  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private markers?: Leaflet.LayerGroup;
  private radiusCircle?: Leaflet.Circle;
  private readonly markerByRecord = new Map<PriceRecord, Leaflet.CircleMarker>();
  private pendingRecord?: PriceRecord;

  readonly records = input.required<PriceRecord[]>();
  readonly searchLocation = input<GeographicSearch | null>(null);
  protected readonly mappedRecords = computed(
    () => this.records().filter((record) => recordCoordinates(record) !== null).length,
  );

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        void this.initializeMap();
      }
    });
    afterRenderEffect({
      write: () => this.updateMap(this.records(), this.searchLocation()),
    });
    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  showRecord(record: PriceRecord): void {
    this.pendingRecord = record;
    this.revealRecord(record);
  }

  private async initializeMap(): Promise<void> {
    this.leaflet = (await import('leaflet')).default;
    this.map = this.leaflet.map(this.mapContainer().nativeElement, {
      center: [-9.653, -35.716],
      scrollWheelZoom: true,
      zoom: 8,
    });
    this.leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);
    this.markers = this.leaflet.layerGroup().addTo(this.map);
    this.updateMap(this.records(), this.searchLocation());
  }

  private updateMap(records: PriceRecord[], searchLocation: GeographicSearch | null): void {
    if (!this.leaflet || !this.map || !this.markers) {
      return;
    }

    this.markers.clearLayers();
    this.markerByRecord.clear();
    this.radiusCircle?.remove();
    const bounds = this.leaflet.latLngBounds([]);

    for (const record of records) {
      const coordinates = recordCoordinates(record);
      if (!coordinates) {
        continue;
      }
      bounds.extend(coordinates);
      const marker = this.leaflet
        .circleMarker(coordinates, {
          className: 'results-sale-marker search-sale-marker',
          color: 'var(--tq-card)',
          fillColor: 'var(--color-primary)',
          fillOpacity: 1,
          radius: 9,
          weight: 3,
        })
        .bindPopup(this.popupContent(record))
        .addTo(this.markers);
      this.markerByRecord.set(record, marker);
      this.makeMarkerAccessible(marker, record);
    }

    if (searchLocation) {
      this.radiusCircle = this.leaflet
        .circle([searchLocation.latitude, searchLocation.longitude], {
          className: 'search-radius',
          color: 'var(--color-primary)',
          fillColor: 'var(--color-primary)',
          fillOpacity: 0.12,
          interactive: false,
          radius: searchLocation.radius * 1000,
          weight: 2,
        })
        .addTo(this.map);
      bounds.extend(this.radiusCircle.getBounds());
    }

    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { maxZoom: 15, padding: [24, 24] });
    } else {
      this.map.setView([-9.653, -35.716], 8);
    }
    requestAnimationFrame(() => this.map?.invalidateSize());
    if (this.pendingRecord) {
      this.revealRecord(this.pendingRecord);
    }
  }

  private revealRecord(record: PriceRecord): void {
    const marker = this.markerByRecord.get(record);
    if (!marker || !this.map) {
      return;
    }
    this.pendingRecord = undefined;
    this.mapContainer().nativeElement.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
    this.map.panTo(marker.getLatLng());
    marker.openPopup();
  }

  private makeMarkerAccessible(marker: Leaflet.CircleMarker, record: PriceRecord): void {
    const element = marker.getElement();
    element?.setAttribute('role', 'button');
    element?.setAttribute('tabindex', '0');
    element?.setAttribute(
      'aria-label',
      `${formatTitle(record.store.name)} - ${formatSaleValue(record)}`,
    );
    element?.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        event.preventDefault();
        marker.openPopup();
      }
    });
  }

  private popupContent(record: PriceRecord): string {
    return [
      `<strong>${this.escapeHtml(formatSaleValue(record))}</strong>`,
      this.escapeHtml(formatTitle(record.description)),
      this.escapeHtml(formatTitle(record.store.name)),
      this.escapeHtml(formatAddress(record.location.address)),
      this.escapeHtml(formatSaleTime(record)),
    ].join('<br>');
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
