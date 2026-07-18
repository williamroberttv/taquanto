import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Home } from './home';

describe('Home', () => {
  let component: Home;
  let fixture: ComponentFixture<Home>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
    }).compileComponents();

    fixture = TestBed.createComponent(Home);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should present the landing page content', () => {
    const compiled = fixture.nativeElement as HTMLElement;
    const text = compiled.textContent ?? '';

    expect(text).toContain('Descubra quanto produtos custaram em Alagoas.');
    expect(text).toContain('Registros oficiais, organizados para comparar.');
    expect(text).toContain('Guarde a venda, não uma promessa de preço.');
    expect(text).toContain('Buscar produto');
    expect(text).toContain('Prévia no mapa');
    expect(compiled.querySelector('summary[aria-label="Abrir menu de navegação"]')).not.toBeNull();
    expect(compiled.querySelector('a[href="/favoritos"]')?.textContent).toContain('Favoritos');
    expect(
      [...compiled.querySelectorAll<HTMLImageElement>('img')].map((image) => image.src),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('/images/elephant-1.png'),
        expect.stringContaining('/images/elephant-3.png'),
      ]),
    );
  });
});
