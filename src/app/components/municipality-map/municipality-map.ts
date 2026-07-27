import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import {
  afterNextRender,
  afterRenderEffect,
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

export interface MunicipalitySelection {
  code: string;
  name: string;
}

type MunicipalityCollection = FeatureCollection<Geometry, MunicipalitySelection>;
type MunicipalityFeature = Feature<Geometry, MunicipalitySelection>;
type MunicipalityPath = Leaflet.Path & { feature?: MunicipalityFeature };

@Component({
  selector: 'app-municipality-map',
  templateUrl: './municipality-map.html',
  styleUrl: './municipality-map.scss',
})
export class MunicipalityMap {
  private readonly defaultMunicipality: MunicipalitySelection = {
    code: '2704302',
    name: 'Maceió',
  };
  private readonly destroyRef = inject(DestroyRef);
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');

  readonly selectedCode = input('2704302');
  readonly municipalityChange = output<MunicipalitySelection>();
  readonly municipalityReady = output<MunicipalitySelection>();

  protected readonly municipalities = signal<MunicipalitySelection[]>([]);
  protected readonly loadError = signal(false);
  protected readonly resolvedSelectedCode = computed(() =>
    this.municipalities().some(({ code }) => code === this.selectedCode())
      ? this.selectedCode()
      : this.defaultMunicipality.code,
  );

  private leaflet?: typeof Leaflet;
  private map?: Leaflet.Map;
  private municipalityLayer?: Leaflet.GeoJSON<MunicipalitySelection>;

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        this.loadMunicipalities();
      }
    });

    afterRenderEffect({
      write: () => this.updateLayerState(this.resolvedSelectedCode()),
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

    this.leaflet = (await import('leaflet')).default;
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
    const selection = this.selectionFor(code);
    if (!selection) {
      return;
    }
    this.updateLayerState(code);
    this.municipalityChange.emit(selection);
  }

  private announceReady(): void {
    const resolvedCode = this.resolvedSelectedCode();
    const selection = this.selectionFor(resolvedCode) ?? this.defaultMunicipality;
    this.municipalityReady.emit(selection);
    if (resolvedCode !== this.selectedCode()) {
      this.municipalityChange.emit(selection);
    }
  }

  private selectionFor(code: string): MunicipalitySelection | undefined {
    return (
      this.municipalities().find((municipality) => municipality.code === code) ??
      (code === this.defaultMunicipality.code ? this.defaultMunicipality : undefined)
    );
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
        permanent: false,
        sticky: true,
      });
      path.getElement()?.setAttribute('aria-pressed', String(selected));
    });
  }

  private layerStyle(selected: boolean): Leaflet.PathOptions {
    return {
      color: selected ? 'var(--color-primary)' : '#9b91c3',
      fillColor: selected ? 'var(--color-primary)' : 'var(--color-base-300)',
      fillOpacity: selected ? 0.9 : 0.72,
      weight: selected ? 2 : 1,
    };
  }
}
