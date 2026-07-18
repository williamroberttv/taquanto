import { Service, signal } from '@angular/core';
import { PriceRecord } from './taquanto-api';

export interface FavoriteSaleRecord {
  record: PriceRecord;
  savedAt: number;
}

@Service()
export class Favorites {
  private readonly storageKey = 'taquanto:favorite-sales';
  private readonly savedRecords = signal(this.load());

  readonly records = this.savedRecords.asReadonly();

  has(record: PriceRecord): boolean {
    const key = this.key(record);
    return this.savedRecords().some((favorite) => this.key(favorite.record) === key);
  }

  toggle(record: PriceRecord): boolean {
    const key = this.key(record);
    const existingIndex = this.savedRecords().findIndex(
      (favorite) => this.key(favorite.record) === key,
    );
    const records =
      existingIndex === -1
        ? [{ record: structuredClone(record), savedAt: Date.now() }, ...this.savedRecords()]
        : this.savedRecords().filter((_, index) => index !== existingIndex);

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(records));
      this.savedRecords.set(records);
      return true;
    } catch {
      return false;
    }
  }

  private load(): FavoriteSaleRecord[] {
    try {
      const value = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]') as unknown;
      return Array.isArray(value) ? value.filter(this.isFavoriteSaleRecord) : [];
    } catch {
      return [];
    }
  }

  private key(record: PriceRecord): string {
    return JSON.stringify([
      record.description,
      record.gtin,
      record.source_product_code,
      record.declared_value_cents,
      record.sale_value_cents,
      record.unit,
      record.sold_at,
      record.store.name,
      record.store.cnpj,
      record.location.latitude,
      record.location.longitude,
      record.location.address,
      record.location.district,
      record.location.city,
      record.location.zip_code,
      record.location.source,
    ]);
  }

  private isFavoriteSaleRecord(value: unknown): value is FavoriteSaleRecord {
    if (!value || typeof value !== 'object') {
      return false;
    }
    const favorite = value as Record<string, unknown>;
    const record = favorite['record'];
    if (!record || typeof record !== 'object' || typeof favorite['savedAt'] !== 'number') {
      return false;
    }
    const sale = record as Record<string, unknown>;
    const store = sale['store'];
    const location = sale['location'];
    const savedStore = store as Record<string, unknown>;
    const savedLocation = location as Record<string, unknown>;
    return (
      typeof sale['description'] === 'string' &&
      typeof sale['gtin'] === 'string' &&
      typeof sale['source_product_code'] === 'string' &&
      typeof sale['declared_value_cents'] === 'number' &&
      typeof sale['sale_value_cents'] === 'number' &&
      typeof sale['unit'] === 'string' &&
      typeof sale['sold_at'] === 'string' &&
      !!store &&
      typeof store === 'object' &&
      typeof savedStore['name'] === 'string' &&
      typeof savedStore['cnpj'] === 'string' &&
      !!location &&
      typeof location === 'object' &&
      (savedLocation['latitude'] === null ||
        typeof savedLocation['latitude'] === 'number' ||
        typeof savedLocation['latitude'] === 'string') &&
      (savedLocation['longitude'] === null ||
        typeof savedLocation['longitude'] === 'number' ||
        typeof savedLocation['longitude'] === 'string') &&
      typeof savedLocation['address'] === 'string' &&
      typeof savedLocation['district'] === 'string' &&
      typeof savedLocation['city'] === 'string' &&
      typeof savedLocation['zip_code'] === 'string' &&
      typeof savedLocation['source'] === 'string'
    );
  }
}
