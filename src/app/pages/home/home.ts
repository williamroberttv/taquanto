import { isPlatformBrowser } from '@angular/common';
import { afterNextRender, Component, DestroyRef, ElementRef, PLATFORM_ID, inject, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';

interface Step {
  title: string;
  description: string;
}

interface SalePreview {
  product: string;
  price: string;
  place: string;
  area: string;
  time: string;
  coordinates: [number, number];
}

@Component({
  selector: 'app-home',
  imports: [Header, Footer],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private map?: Leaflet.Map;

  protected readonly steps: Step[] = [
    {
      title: 'Procure o produto',
      description: 'Digite o nome do item ou use o código de barras quando tiver a embalagem por perto.',
    },
    {
      title: 'Compare preços reais',
      description: 'Veja quanto outras pessoas pagaram recentemente e onde esses valores apareceram.',
    },
    {
      title: 'Escolha melhor onde comprar',
      description: 'Encontre uma referência antes de sair de casa e evite pagar mais caro por falta de informação.',
    },
  ];

  protected readonly salesPreview: SalePreview[] = [
    {
      product: 'Café 250 g',
      price: 'R$ 8,79',
      place: 'Mercado Ponta Verde',
      area: 'Maceió',
      time: 'há 2 h',
      coordinates: [-9.6621, -35.7047],
    },
    {
      product: 'Leite integral 1 L',
      price: 'R$ 5,49',
      place: 'Atacarejo Farol',
      area: 'Maceió',
      time: 'há 4 h',
      coordinates: [-9.6464, -35.7351],
    },
    {
      product: 'Arroz 1 kg',
      price: 'R$ 6,29',
      place: 'Supermercado Jatiúca',
      area: 'Maceió',
      time: 'hoje',
      coordinates: [-9.6501, -35.7012],
    },
  ];

  constructor() {
    afterNextRender(() => {
      if (isPlatformBrowser(this.platformId)) {
        void this.initializeMap();
      }
    });

    this.destroyRef.onDestroy(() => {
      this.map?.remove();
    });
  }

  private async initializeMap(): Promise<void> {
    const container = this.mapContainer()?.nativeElement;

    if (!container || this.map) {
      return;
    }

    const leaflet = await import('leaflet');
    const markerIcon = leaflet.divIcon({
      className: 'sale-marker',
      html: '<span></span>',
      iconSize: [28, 28],
      iconAnchor: [14, 28],
      popupAnchor: [0, -26],
    });

    this.map = leaflet.map(container, {
      center: [-9.653, -35.716],
      zoom: 13,
      zoomControl: false,
      scrollWheelZoom: false,
      dragging: false,
    });

    const tileLayer = leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });

    tileLayer.addTo(this.map);

    requestAnimationFrame(() => {
      this.map?.invalidateSize();
    });

    for (const sale of this.salesPreview) {
      leaflet
        .marker(sale.coordinates, { icon: markerIcon, title: `${sale.product} - ${sale.price}` })
        .bindPopup(`<strong>${sale.product}</strong><br>${sale.price}<br>${sale.place}`)
        .addTo(this.map);
    }
  }
}
