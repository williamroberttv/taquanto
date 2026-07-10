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

    expect(text).toContain('Encontre melhores preços antes de comprar.');
    expect(text).toContain('Menos tempo pesquisando, mais chance de economizar.');
    expect(text).toContain('Buscar produto');
    expect(text).toContain('Prévia no mapa');
    expect(text).toContain('Compare preços em Alagoas');
  });
});
