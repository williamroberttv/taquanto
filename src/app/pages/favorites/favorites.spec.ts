import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Favorites as FavoritesStore } from '../../services/favorites';
import { PriceRecord } from '../../services/taquanto-api';
import { FavoritesPage } from './favorites';

const favoriteRecord: PriceRecord = {
  description: 'Arroz branco 1kg',
  gtin: '7891234567890',
  source_product_code: '42',
  declared_value_cents: 629,
  sale_value_cents: 599,
  unit: 'UN',
  sold_at: '2026-07-17T12:00:00Z',
  store: { name: 'Mercado Centro', cnpj: '00000000000000' },
  location: {
    latitude: -9.6658,
    longitude: -35.735,
    address: 'Rua do Comércio, 10',
    district: 'Centro',
    city: 'Maceió',
    zip_code: '57000-000',
    source: 'sefaz',
  },
};

describe('FavoritesPage', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [FavoritesPage],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('lists favorite sale details newest first and removes them in place', async () => {
    vi.spyOn(Date, 'now').mockReturnValueOnce(100).mockReturnValueOnce(200);
    const favorites = TestBed.inject(FavoritesStore);
    favorites.toggle(favoriteRecord);
    favorites.toggle({
      ...favoriteRecord,
      description: 'Feijão carioca 1kg',
      gtin: '7891234567891',
      location: { ...favoriteRecord.location, latitude: null, longitude: null },
    });
    const fixture = TestBed.createComponent(FavoritesPage);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;

    const records = element.querySelectorAll<HTMLElement>('.favorite-record');
    expect(records).toHaveLength(2);
    expect(records[0].textContent).toContain('Feijão carioca 1kg');
    expect(records[0].textContent).toContain('R$ 5,99');
    expect(records[0].querySelector('a')).toBeNull();
    expect(records[1].querySelector('a')?.textContent).toContain('Abrir no mapa');

    records[0].querySelector<HTMLButtonElement>('.favorite-toggle')?.click();
    await fixture.whenStable();

    expect(element.querySelectorAll('.favorite-record')).toHaveLength(1);
    expect(element.textContent).not.toContain('Feijão carioca 1kg');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
});
