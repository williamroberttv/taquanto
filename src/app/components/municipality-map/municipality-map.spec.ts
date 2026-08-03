import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MunicipalityMap } from './municipality-map';

vi.mock('leaflet', async (importOriginal) => {
  await new Promise((resolve) => setTimeout(resolve, 100));
  return importOriginal();
});

describe('MunicipalityMap', () => {
  let fixture: ComponentFixture<MunicipalityMap>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MunicipalityMap],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MunicipalityMap);
    fixture.componentRef.setInput('selectedCode', '2704302');
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    const mapContainer = (fixture.nativeElement as HTMLElement).querySelector('.municipality-map')!;
    Object.defineProperties(mapContainer, {
      clientHeight: { value: 400 },
      clientWidth: { value: 800 },
    });
    http.expectOne('/assets/alagoas-municipios.geojson').flush({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { code: '2700300', name: 'Arapiraca' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-36.7, -9.8],
                [-36.6, -9.8],
                [-36.6, -9.7],
                [-36.7, -9.8],
              ],
            ],
          },
        },
        {
          type: 'Feature',
          properties: { code: '2704302', name: 'Maceió' },
          geometry: {
            type: 'Polygon',
            coordinates: [
              [
                [-35.8, -9.7],
                [-35.7, -9.7],
                [-35.7, -9.6],
                [-35.8, -9.7],
              ],
            ],
          },
        },
      ],
    });
    await fixture.whenStable();
    await vi.waitFor(() =>
      expect(
        (fixture.nativeElement as HTMLElement).querySelector('[aria-label="Selecionar Maceió"]'),
      ).not.toBeNull(),
    );
  });

  it('emits a municipality selected on the map', async () => {
    const selected: { code: string; name: string }[] = [];
    fixture.componentInstance.municipalityChange.subscribe((selection) =>
      selected.push(selection),
    );
    const element = fixture.nativeElement as HTMLElement;
    element
      .querySelector<SVGElement>('[aria-label="Selecionar Arapiraca"]')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();

    expect(selected).toEqual([{ code: '2700300', name: 'Arapiraca' }]);
  });

  it('renders an accessible Leaflet map', () => {
    const element = fixture.nativeElement as HTMLElement;
    const maceio = element.querySelector<SVGElement>('[aria-label="Selecionar Maceió"]');

    expect(element.querySelector('.leaflet-map-pane')).not.toBeNull();
    expect(maceio?.getAttribute('role')).toBe('button');
    expect(maceio?.getAttribute('tabindex')).toBe('0');
    expect(maceio?.getAttribute('aria-pressed')).toBe('true');
  });

  it('updates the highlighted municipality when the selected code changes', async () => {
    fixture.componentRef.setInput('selectedCode', '2700300');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(
      element
        .querySelector<SVGElement>('[aria-label="Selecionar Arapiraca"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      element
        .querySelector<SVGElement>('[aria-label="Selecionar Maceió"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
  });

  it('shows an alert when the municipality data cannot be loaded', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(MunicipalityMap);
    await fixture.whenStable();

    http.expectOne('/assets/alagoas-municipios.geojson').flush(null, {
      status: 500,
      statusText: 'Server Error',
    });
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(
      'Não foi possível carregar o mapa.',
    );
    expect(element.querySelector('.municipality-map')?.getAttribute('aria-busy')).toBe('false');
  });

  afterEach(() => http.verify());
});
