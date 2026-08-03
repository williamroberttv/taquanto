import { isPlatformBrowser, NgOptimizedImage } from '@angular/common';
import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  PLATFORM_ID,
  inject,
  viewChild,
} from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import type * as Leaflet from 'leaflet';
import { environment } from '../../../environments/environment';
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
  imports: [Header, Footer, NgOptimizedImage],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly mapContainer = viewChild<ElementRef<HTMLElement>>('mapContainer');
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private map?: Leaflet.Map;

  protected readonly steps: Step[] = [
    {
      title: 'Escolha a consulta',
      description:
        'Pesquise um produto por descrição ou GTIN, ou selecione uma categoria de combustível.',
    },
    {
      title: 'Defina município e período',
      description: 'Use o mesmo contexto geográfico e uma janela recente para comparar os dados.',
    },
    {
      title: 'Compare os registros',
      description:
        'Confira valor, estabelecimento e data; são vendas históricas, não ofertas garantidas.',
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
    const description =
      'Consulte registros reais de vendas NFC-e de produtos e combustíveis em Alagoas. Compare valor, estabelecimento, data e município.';

    this.title.setTitle('Preços em Alagoas | TáQuanto');
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: 'Preços em Alagoas | TáQuanto' });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: `${environment.siteUrl}/` });
    this.meta.updateTag({
      property: 'og:image',
      content: `${environment.siteUrl}/images/elephant-3.png`,
    });
    this.meta.updateTag({ name: 'twitter:title', content: 'Preços em Alagoas | TáQuanto' });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({
      name: 'twitter:image',
      content: `${environment.siteUrl}/images/elephant-3.png`,
    });
    this.meta.updateTag({ rel: 'canonical', href: `${environment.siteUrl}/` });

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

    const leaflet = (await import('leaflet')).default;
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

    leaflet
      .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      })
      .addTo(this.map);

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
