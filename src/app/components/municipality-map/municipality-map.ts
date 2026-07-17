import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Feature, FeatureCollection, Geometry } from 'geojson';
import type * as Leaflet from 'leaflet';

interface MunicipalityProperties {
  code: string;
  name: string;
}

type MunicipalityCollection = FeatureCollection<Geometry, MunicipalityProperties>;
type MunicipalityFeature = Feature<Geometry, MunicipalityProperties>;
type MunicipalityPath = Leaflet.Path & { feature?: MunicipalityFeature };

@Component({
  selector: 'app-municipality-map',
  templateUrl: './municipality-map.html',
  styleUrl: './municipality-map.scss',
})
export class MunicipalityMap {
  private readonly defaultMunicipality = '2704302';
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

  readonly selectedCode = input('2704302');
  readonly municipalityChange = output<string>();
  readonly municipalityReady = output<string>();

  protected readonly municipalities = signal<MunicipalityProperties[]>([]);
  protected readonly loadError = signal(false);
  protected readonly resolvedSelectedCode = computed(() =>
    this.municipalities().some(({ code }) => code === this.selectedCode())
      ? this.selectedCode()
      : this.defaultMunicipality,
  );
  protected readonly selectedName = computed(
    () =>
      this.municipalities().find(
        (municipality) => municipality.code === this.resolvedSelectedCode(),
      )?.name ?? 'Maceió',
  );

  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private municipalityLayer?: Leaflet.GeoJSON<MunicipalityProperties>;

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.loadMunicipalities();
      }
    });

    this.destroyRef.onDestroy(() => this.map?.remove());
  }

  protected selectFromControl(event: Event): void {
    this.selectMunicipality((event.target as HTMLSelectElement).value);
  }

  private loadMunicipalities(): void {
    this.http.get<MunicipalityCollection>('/assets/alagoas-municipios.geojson').subscribe({
      next: (collection) => {
        this.municipalities.set(
          collection.features
            .map(({ properties }) => properties)
            .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
        );
        this.announceReady();
        void this.initializeMap(collection);
      },
      error: () => {
        this.loadError.set(true);
        this.announceReady();
      },
    });
  }

  private async initializeMap(collection: MunicipalityCollection): Promise<void> {
    const container = this.mapContainer()?.nativeElement;
    if (!container || this.map || container.clientWidth === 0 || container.clientHeight === 0) {
      return;
    }

    this.leaflet = await import('leaflet');
    this.map = this.leaflet.map(container, {
      attributionControl: false,
      scrollWheelZoom: false,
      zoomControl: true,
    });
    this.municipalityLayer = this.leaflet.geoJSON(collection, {
      style: (feature) => this.layerStyle(feature?.properties.code === this.resolvedSelectedCode()),
      onEachFeature: (feature, layer) => {
        layer.on('click', () => this.selectMunicipality(feature.properties.code));
        layer.once('add', () => this.makeLayerAccessible(layer as MunicipalityPath, feature));
      },
    });
    this.municipalityLayer.addTo(this.map);
    this.map.fitBounds(this.municipalityLayer.getBounds(), { padding: [12, 12] });
    this.updateLayerState(this.resolvedSelectedCode());
    requestAnimationFrame(() => this.map?.invalidateSize());
  }

  private makeLayerAccessible(layer: MunicipalityPath, feature: MunicipalityFeature): void {
    const element = layer.getElement();
    if (!element) {
      return;
    }

    element.setAttribute('role', 'button');
    element.setAttribute('tabindex', '0');
    element.setAttribute('aria-label', `Selecionar ${feature.properties.name}`);
    element.addEventListener('keydown', (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (keyboardEvent.key === 'Enter' || keyboardEvent.key === ' ') {
        event.preventDefault();
        this.selectMunicipality(feature.properties.code);
      }
    });
  }

  private selectMunicipality(code: string): void {
    if (!code) {
      return;
    }
    this.updateLayerState(code);
    this.municipalityChange.emit(code);
  }

  private announceReady(): void {
    const resolvedCode = this.resolvedSelectedCode();
    this.municipalityReady.emit(resolvedCode);
    if (resolvedCode !== this.selectedCode()) {
      this.municipalityChange.emit(resolvedCode);
    }
  }

  private updateLayerState(selectedCode: string): void {
    this.municipalityLayer?.eachLayer((layer) => {
      const path = layer as MunicipalityPath;
      const properties = path.feature?.properties;
      if (!properties) {
        return;
      }

      const selected = properties.code === selectedCode;
      path.setStyle(this.layerStyle(selected));
      path.unbindTooltip();
      path.bindTooltip(properties.name, {
        className: 'municipality-name',
        direction: 'center',
        permanent: selected,
        sticky: !selected,
      });
      path.getElement()?.setAttribute('aria-pressed', String(selected));
    });
  }

  private layerStyle(selected: boolean): Leaflet.PathOptions {
    return {
      color: selected ? '#5635d8' : '#9b91c3',
      fillColor: selected ? '#6c47ff' : '#f0edff',
      fillOpacity: selected ? 0.9 : 0.72,
      weight: selected ? 2 : 1,
    };
  }
}
