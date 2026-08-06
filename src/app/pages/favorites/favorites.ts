import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { Favorites as FavoritesStore } from '../../services/favorites';
import { PriceRecord } from '../../services/taquanto-api';
import { SaleRecordCard } from '../search/sale-record-card';
import { SaleRecordDetailDialog } from '../search/sale-record-detail-dialog';

@Component({
  selector: 'app-favorites',
  imports: [Header, Footer, SaleRecordCard, SaleRecordDetailDialog],
  templateUrl: './favorites.html',
  styleUrl: './favorites.scss',
})
export class FavoritesPage {
  private readonly favorites = inject(FavoritesStore);
  private readonly removeDialog = viewChild<ElementRef<HTMLDialogElement>>('removeDialog');

  protected readonly records = this.favorites.records;
  protected readonly message = signal<string | null>(null);
  protected readonly selectedRecord = signal<PriceRecord | null>(null);
  protected readonly pendingRemoval = signal<PriceRecord | null>(null);

  protected openRecordDetail(record: PriceRecord): void {
    this.selectedRecord.set(record);
  }

  protected closeRecordDetail(): void {
    this.selectedRecord.set(null);
  }

  protected requestRemoval(record: PriceRecord): void {
    this.pendingRemoval.set(record);
    requestAnimationFrame(() => this.removeDialog()?.nativeElement.showModal?.());
  }

  protected cancelRemoval(): void {
    this.pendingRemoval.set(null);
  }

  protected confirmRemoval(): void {
    const record = this.pendingRemoval();
    if (!record) {
      return;
    }
    this.message.set(
      this.favorites.toggle(record) ? null : 'Não foi possível atualizar os favoritos.',
    );
    this.selectedRecord.set(null);
    this.pendingRemoval.set(null);
  }
}
