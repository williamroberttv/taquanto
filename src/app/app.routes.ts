import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  {
    path: '',
    component: Home,
    title: 'TaQuanto | Compare preços em Alagoas e economize',
    data: {
      description:
        'Compare preços de produtos e combustíveis em Alagoas. Descubra onde pagar menos e economize nas suas compras.',
    },
  },
  {
    path: 'produtos',
    loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage),
    title: 'Preços de Produtos em Alagoas | TaQuanto',
    data: {
      description:
        'Compare preços de produtos em estabelecimentos de Alagoas e encontre as melhores opções para economizar.',
    },
  },
  {
    path: 'buscar',
    redirectTo: 'produtos',
    pathMatch: 'full',
  },
  {
    path: 'combustiveis',
    loadComponent: () => import('./pages/fuels/fuels').then((m) => m.FuelsPage),
    title: 'Preços de Combustíveis em Alagoas | TaQuanto',
    data: {
      description:
        'Compare preços de gasolina, etanol, diesel e GNV em Alagoas e encontre combustível mais barato perto de você.',
    },
  },
  {
    path: 'favoritos',
    loadComponent: () => import('./pages/favorites/favorites').then((m) => m.FavoritesPage),
    title: 'Favoritos de Alagoas | TaQuanto',
  },
];
