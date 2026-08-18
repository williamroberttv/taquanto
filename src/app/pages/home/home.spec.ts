import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Analytics } from '../../services/analytics';
import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;
  let analytics: { capture: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    analytics = { capture: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [{ provide: Analytics, useValue: analytics }],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the same tiles as the product map', async () => {
    const compiled = fixture.nativeElement as HTMLElement;
    await vi.waitFor(() => expect(compiled.querySelector('.leaflet-tile')).not.toBeNull());

    const tile = compiled.querySelector<HTMLImageElement>('.leaflet-tile')!;
    expect(tile.src).toContain('tile.openstreetmap.org');
  });

  it('should present the landing page content', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(text).toContain('Descubra quanto custa');
    expect(compiled.querySelector('.text-rotate')?.textContent).toContain('o café');
    expect(compiled.querySelector('.text-rotate')?.textContent).toContain('a gasolina');
    expect(compiled.querySelector('.text-rotate')?.textContent).toContain('o etanol');
    expect(text).toContain('Vendas registradas em NFC-e, organizadas para consulta');
    expect(text).toContain('Três passos para comparar registros de venda.');
    expect(text).toContain('Busque por município ou perto de você.');
    expect(text).toContain('raio de 5, 10 ou 15 km');
    expect(text).toContain('Retome pesquisas e guarde vendas, não promessas de preço.');
    expect(text).toContain('Exemplo de busca por produto');
    expect(text).toContain('Prévia no mapa');
    expect(
      compiled.querySelector('summary[aria-label="Abrir menu de navegação"]')?.parentElement
        ?.classList,
    ).toContain('md:hidden');
    expect(
      [...compiled.querySelectorAll<HTMLElement>('header nav.hidden a')].map((link) =>
        link.textContent?.trim(),
      ),
    ).toEqual(['Produtos', 'Combustíveis', 'Favoritos']);
    expect(compiled.querySelector('.theme-controller')).not.toBeNull();
    expect(compiled.querySelectorAll('.mask-squircle')).toHaveLength(3);
    expect(compiled.querySelector('a[href="/favoritos"]')?.textContent).toContain('Favoritos');
    expect(compiled.querySelector('.hero a[href="/produtos"]')?.textContent).toContain(
      'Pesquisar produtos',
    );
    expect(compiled.querySelector('.hero a[href="/combustiveis"]')?.textContent).toContain(
      'Pesquisar combustíveis',
    );
    expect(compiled.querySelectorAll('[aria-label="Tipos de consulta"] article')).toHaveLength(2);
    expect(compiled.querySelector('footer a[href="/#como-funciona"]')).not.toBeNull();
    expect(
      [...compiled.querySelectorAll<HTMLImageElement>('img')].map((image) => image.src),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/images/elephant-1.png'),
        expect.stringContaining('/images/elephant-3.png'),
      ]),
    );
  });

  it('tracks the landing page calls to action', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const links = [
      compiled.querySelector<HTMLAnchorElement>('.hero a[href="/produtos"]')!,
      compiled.querySelector<HTMLAnchorElement>('.hero a[href="/combustiveis"]')!,
      compiled.querySelector<HTMLAnchorElement>('main a[href="/favoritos"]')!,
    ];
    links.forEach((link) => link.addEventListener('click', (event) => event.preventDefault()));

    links.forEach((link) => link.click());

    expect(analytics.capture.mock.calls).toEqual([
      ['landing cta clicked', { cta: 'products', destination: '/produtos' }],
      ['landing cta clicked', { cta: 'fuels', destination: '/combustiveis' }],
      ['landing cta clicked', { cta: 'favorites', destination: '/favoritos' }],
    ]);
  });
});
