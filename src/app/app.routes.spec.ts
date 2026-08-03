import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, Routes } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';

@Component({ template: '' })
class RouteTarget {}

describe('app routes', () => {
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    const testRoutes: Routes = routes.map((route) =>
      route.path === 'produtos' ? { path: route.path, component: RouteTarget } : route,
    );

    TestBed.configureTestingModule({ providers: [provideRouter(testRoutes)] });
    harness = await RouterTestingHarness.create();
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
