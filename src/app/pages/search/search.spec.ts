import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router } from '@angular/router';
import { of } from 'rxjs';
import { PriceRecord, SearchResponse, TaquantoApi } from '../../services/taquanto-api';
import { SearchPage } from './search';

class TaquantoApiStub {
  readonly priceCalls: { limit: number; page: number; category?: string }[] = [];
  results: PriceRecord[] = [];

  categories() {
    return of<SearchResponse>({
      query: 'arroz',
      source: 'test',
      results: [],
      categories: [{ source_sku: '50000000', name: 'Alimentos', count: 2 }],
    });
  }

  prices(_query: string, params: { limit: number; page: number; category?: string }) {
    this.priceCalls.push(params);
    return of<SearchResponse>({
      query: 'arroz',
      source: 'test',
      results: this.results,
      pagination: { page: params.page, offset: 0, limit: params.limit, total: this.results.length },
    });
  }
}

describe('SearchPage', () => {
  let fixture: ComponentFixture<SearchPage>;
  let api: TaquantoApiStub;

  beforeEach(async () => {
    localStorage.clear();
    api = new TaquantoApiStub();

    await TestBed.configureTestingModule({
      imports: [SearchPage],
      providers: [
        { provide: TaquantoApi, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: { get: () => null } } } },
        { provide: Router, useValue: { navigate: () => Promise.resolve(true) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SearchPage);
    fixture.detectChanges();
  });

  it('requests ten prices when a category is selected', async () => {
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query');
    const form = element.querySelector<HTMLFormElement>('form');

    expect(input).toBeTruthy();
    expect(form).toBeTruthy();

    input!.value = 'arroz';
    input!.dispatchEvent(new Event('input'));
    form!.dispatchEvent(new SubmitEvent('submit'));

    await fixture.whenStable();
    fixture.detectChanges();

    const category = element.querySelector<HTMLButtonElement>('.category-card');
    expect(category).toBeTruthy();

    category!.click();
    await fixture.whenStable();

    expect(api.priceCalls[0]).toEqual({ category: '50000000', limit: 10, page: 1 });
  });

  it('opens a detail modal from a price card', async () => {
    api.results = [
      {
        description: 'Arroz branco 1kg',
        barcode: '7891234567890',
        source_sku: '50000000',
        unit_price_cents: 629,
        unit: 'UN',
        last_sale_cents: 629,
        last_sale_age: 'ha 1 hora',
        sold_at: null,
        store: { name: 'Mercado Centro', source_id: '42' },
        location: {
          latitude: null,
          longitude: null,
          address: 'Rua do Comercio, 10',
          district: 'Centro',
          city: 'Maceio',
          zip_code: '57000-000',
          source: 'sefaz',
        },
      },
    ];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query');
    const form = element.querySelector<HTMLFormElement>('form');

    input!.value = '7891234567890';
    input!.dispatchEvent(new Event('input'));
    form!.dispatchEvent(new SubmitEvent('submit'));

    await fixture.whenStable();
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = element.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).toContain('Arroz branco 1kg');
    expect(dialog?.textContent).toContain('Mercado Centro');
    expect(dialog?.textContent).toContain('Localização no mapa não informada pela fonte');
  });

  it('treats string coordinates as a mapped location', async () => {
    api.results = [
      {
        description: 'Arroz branco 1kg',
        barcode: '7891234567890',
        source_sku: '50000000',
        unit_price_cents: 629,
        unit: 'UN',
        last_sale_cents: 629,
        last_sale_age: 'ha 1 hora',
        sold_at: null,
        store: { name: 'Mercado Centro', source_id: '42' },
        location: {
          latitude: '-9.653',
          longitude: '-35.716',
          address: 'Rua do Comercio, 10',
          district: 'Centro',
          city: 'Maceio',
          zip_code: '57000-000',
          source: 'sefaz',
        },
      },
    ];
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query');
    const form = element.querySelector<HTMLFormElement>('form');

    input!.value = '7891234567890';
    input!.dispatchEvent(new Event('input'));
    form!.dispatchEvent(new SubmitEvent('submit'));

    await fixture.whenStable();
    fixture.detectChanges();

    element.querySelector<HTMLButtonElement>('.detail-button')!.click();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = element.querySelector<HTMLElement>('[role="dialog"]');
    expect(dialog?.textContent).not.toContain('Localização no mapa não informada pela fonte');
  });

  it('saves recent searches and repeats them from the chip', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-07-16T01:00:00Z').getTime());
    const element = fixture.nativeElement as HTMLElement;
    const input = element.querySelector<HTMLInputElement>('#product-query');
    const form = element.querySelector<HTMLFormElement>('form');

    input!.value = 'arroz';
    input!.dispatchEvent(new Event('input'));
    form!.dispatchEvent(new SubmitEvent('submit'));

    await fixture.whenStable();
    fixture.detectChanges();

    const chip = element.querySelector<HTMLButtonElement>('.recent-search-chip');
    expect(chip?.textContent).toContain('arroz');
    expect(chip?.textContent).toContain('agora');
    expect(JSON.parse(localStorage.getItem('taquanto:recent-searches') ?? '[]')).toHaveLength(1);

    chip!.click();
    await fixture.whenStable();

    expect(input!.value).toBe('arroz');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });
});
