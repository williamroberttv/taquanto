import { Component, inject, signal } from '@angular/core';
import { Footer } from '../../components/footer/footer';
import { FavoriteToggle } from '../../components/favorite-toggle/favorite-toggle';
import { Header } from '../../components/header/header';
import {
  formatMoney,
  formatSaleDate,
  formatSaleValue,
  locationLine,
  recordMapUrl,
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
  private readonly favorites = inject(FavoritesStore);

  protected readonly records = this.favorites.records;
  protected readonly message = signal<string | null>(null);
  protected readonly formatMoney = formatMoney;
  protected readonly formatSaleDate = formatSaleDate;
  protected readonly formatSaleValue = formatSaleValue;
  protected readonly locationLine = locationLine;
  protected readonly mapUrl = recordMapUrl;

  protected toggle(record: PriceRecord): void {
    this.message.set(
      this.favorites.toggle(record) ? null : 'Não foi possível atualizar os favoritos.',
    );
  }
}
