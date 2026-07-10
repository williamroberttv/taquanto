import { afterNextRender, Component, DestroyRef, ElementRef, inject, viewChild } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';

interface Metric {
  label: string;
  value: string;
}

interface Feature {
  title: string;
  description: string;
}

interface SalePreview {
  product: string;
  price: string;
  place: string;
  area: string;
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
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private map?: Leaflet.Map;

  protected readonly metrics: Metric[] = [
    { label: 'Base inicial', value: 'SEFAZ AL' },
    { label: 'Consulta', value: 'últimas NF-e' },
    { label: 'Status', value: 'em construção' },
  ];

  protected readonly features: Feature[] = [
    {
      title: 'Preços recentes',
      description: 'Consulte valores praticados em vendas registradas em notas fiscais eletrônicas.',
    },
    {
      title: 'Estabelecimentos',
      description: 'Veja onde a venda foi registrada e compare referencias entre mercados, farmácias e lojas.',
    },
    {
      title: 'Mapa por localização',
      description: 'Visualize pontos aproximados para entender onde os valores foram encontrados.',
    },
  ];

  protected readonly salesPreview: SalePreview[] = [
    {
      product: 'Café 250 g',
      price: 'R$ 8,79',
      place: 'Mercado Ponta Verde',
      area: 'Maceió',
      coordinates: [-9.6621, -35.7047],
    },
    {
      product: 'Leite integral 1 L',
      price: 'R$ 5,49',
      place: 'Atacarejo Farol',
      area: 'Maceió',
      coordinates: [-9.6464, -35.7351],
    },
    {
      product: 'Arroz 1 kg',
      price: 'R$ 6,29',
      place: 'Supermercado Jatiuca',
      area: 'Maceió',
      coordinates: [-9.6501, -35.7012],
    },
  ];

  constructor() {
    afterNextRender(() => {
      void this.initializeMap();
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
    });

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);

    for (const sale of this.salesPreview) {
      leaflet
        .marker(sale.coordinates, { icon: markerIcon, title: `${sale.product} - ${sale.price}` })
        .bindPopup(`<strong>${sale.product}</strong><br>${sale.price}<br>${sale.place}`)
        .addTo(this.map);
    }
  }
}
