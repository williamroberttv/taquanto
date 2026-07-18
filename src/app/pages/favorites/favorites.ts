import { isPlatformBrowser } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import type * as Leaflet from 'leaflet';
import { Footer } from '../../components/footer/footer';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import { Header } from '../../components/header/header';
import {
  formatMoney,
  formatSaleDate,
  formatSaleValue,
  locationLine,
  recordCoordinates,
} from '../../price-record';
import { Favorites as FavoritesStore } from '../../services/favorites';
import { PriceRecord } from '../../services/taquanto-api';

@Component({
  selector: 'app-favorites',
  imports: [Header, Footer, FavoriteToggle],
  templateUrl: './favorites.html',
  styleUrl: './favorites.scss',
})
export class FavoritesPage {
  private readonly destroyRef = inject(DestroyRef);
  private readonly favorites = inject(FavoritesStore);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private readonly mapDialog = viewChild<ElementRef<HTMLDialogElement>>('mapDialog');
  private map?: Leaflet.Map;

  protected readonly records = this.favorites.records;
  protected readonly message = signal<string | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly formatMoney = formatMoney;
  protected readonly formatSaleDate = formatSaleDate;
  protected readonly formatSaleValue = formatSaleValue;
  protected readonly locationLine = locationLine;

  constructor() {
    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  protected toggle(record: PriceRecord): void {
    this.message.set(
      this.favorites.toggle(record) ? null : 'Não foi possível atualizar os favoritos.',
    );
  }

  protected hasCoordinates(record: PriceRecord): boolean {
    return recordCoordinates(record) !== null;
  }

  protected openMap(record: PriceRecord): void {
    this.selectedRecord.set(record);
    if (isPlatformBrowser(this.platformId)) {
      requestAnimationFrame(() => {
        this.mapDialog()?.nativeElement.showModal?.();
        void this.initializeMap(record);
      });
    }
  }

  protected dismissMap(): void {
    this.mapDialog()?.nativeElement.close?.();
  }

  protected closeMap(): void {
    this.selectedRecord.set(null);
    this.map?.remove();
    this.map = undefined;
  }

  private async initializeMap(record: PriceRecord): Promise<void> {
    const container = this.mapContainer()?.nativeElement;
    const coordinates = recordCoordinates(record);
    if (!container || !coordinates) {
      return;
    }

    const leaflet = (await import('leaflet')).default;
    this.map = leaflet.map(container, { center: coordinates, scrollWheelZoom: true, zoom: 16 });
    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);
    leaflet
      .circleMarker(coordinates, {
        className: 'search-sale-marker',
        color: 'var(--tq-card)',
        fillColor: 'var(--color-primary)',
        fillOpacity: 1,
        radius: 10,
        weight: 3,
      })
      .addTo(this.map);
    requestAnimationFrame(() => this.map?.invalidateSize());
  }
}
