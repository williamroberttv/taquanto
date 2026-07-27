import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MunicipalityMap } from './municipality-map';

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
  });

  it('offers every loaded municipality and emits the selection', async () => {
    const selected: { code: string; name: string }[] = [];
    fixture.componentInstance.municipalityChange.subscribe((selection) =>
      selected.push(selection),
    );
    const element = fixture.nativeElement as HTMLElement;
    const select = element.querySelector<HTMLSelectElement>('#municipality-select')!;

    expect(Array.from(select.options, (option) => option.text)).toEqual(['Arapiraca', 'Maceió']);
    expect(select.value).toBe('2704302');

    select.value = '2700300';
    select.dispatchEvent(new Event('change'));
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

  it('falls back to Maceió when the selected code is not in Alagoas', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(MunicipalityMap);
    fixture.componentRef.setInput('selectedCode', '9999999');
    const selected: { code: string; name: string }[] = [];
    fixture.componentInstance.municipalityChange.subscribe((selection) =>
      selected.push(selection),
    );
    await fixture.whenStable();

    http.expectOne('/assets/alagoas-municipios.geojson').flush({
      type: 'FeatureCollection',
      features: [
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

    expect(selected).toEqual([{ code: '2704302', name: 'Maceió' }]);
    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector<HTMLSelectElement>('#municipality-select')?.value).toBe('2704302');
  });

  it('shows an alert when the municipality data cannot be loaded', async () => {
    fixture.destroy();
    fixture = TestBed.createComponent(MunicipalityMap);
    const ready: { code: string; name: string }[] = [];
    fixture.componentInstance.municipalityReady.subscribe((selection) => ready.push(selection));
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
    expect(ready).toEqual([{ code: '2704302', name: 'Maceió' }]);
  });

  afterEach(() => http.verify());
});
