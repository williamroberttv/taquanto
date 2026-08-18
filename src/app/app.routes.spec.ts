import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { SeoTitleStrategy } from './seo-title-strategy';

@Component({ template: '' })
class RouteTarget {}

describe('app routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    const testRoutes = routes.map((route) =>
      route.path === '' || route.path === 'produtos' || route.path === 'combustiveis'
        ? { ...route, component: RouteTarget, loadComponent: undefined }
        : route,
    );

    TestBed.configureTestingModule({
      providers: [
        provideRouter(testRoutes),
        { provide: TitleStrategy, useClass: SeoTitleStrategy },
      ],
    });
    const canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      const link = document.createElement('link');
      link.rel = 'canonical';
      document.head.append(link);
    }
    harness = await RouterTestingHarness.create();
  });

  it.each([
    {
      path: '/',
      title: 'TaQuanto | Compare preços em Alagoas e economize',
      description:
        'Compare preços de produtos e combustíveis em Alagoas. Descubra onde pagar menos e economize nas suas compras.',
    },
    {
      path: '/produtos',
      title: 'Preços de Produtos em Alagoas | TaQuanto',
      description:
        'Compare preços de produtos em estabelecimentos de Alagoas e encontre as melhores opções para economizar.',
    },
    {
      path: '/combustiveis',
      title: 'Preços de Combustíveis em Alagoas | TaQuanto',
      description:
        'Compare preços de gasolina, etanol, diesel e GNV em Alagoas e encontre combustível mais barato perto de você.',
    },
  ])('sets the SEO metadata for $path', async ({ path, title, description }) => {
    await harness.navigateByUrl(path, RouteTarget);
    const canonicalUrl = new URL(path, environment.siteUrl).href;

    expect(TestBed.inject(Title).getTitle()).toBe(title);
    expect(TestBed.inject(Meta).getTag("name='description'")?.content).toBe(description);
    expect(TestBed.inject(Meta).getTag("property='og:description'")?.content).toBe(description);
    expect(TestBed.inject(Meta).getTag("property='og:url'")?.content).toBe(canonicalUrl);
    expect(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href).toBe(
      canonicalUrl,
    );
  });

  it('loads the fuel search lazily at /combustiveis', async () => {
    const page = await harness.navigateByUrl('/combustiveis', RouteTarget);

    expect(page).toBeInstanceOf(RouteTarget);
    expect(routes.find((route) => route.path === 'combustiveis')?.loadComponent).toEqual(
      expect.any(Function),
    );
  });

  it('loads the product search lazily at /produtos', async () => {
    const page = await harness.navigateByUrl('/produtos', RouteTarget);

    expect(page).toBeInstanceOf(RouteTarget);
    expect(routes.find((route) => route.path === 'produtos')?.loadComponent).toEqual(
      expect.any(Function),
    );
  });

  it('redirects /buscar to /produtos preserving every query parameter', async () => {
    await harness.navigateByUrl(
      '/buscar?q=arroz&municipality=2700300&days=3&source=shared',
      RouteTarget,
    );

    expect(TestBed.inject(Router).url).toBe(
      '/produtos?q=arroz&municipality=2700300&days=3&source=shared',
    );
  });
});
