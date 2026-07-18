import { Routes } from '@angular/router';
import { Home } from './pages/home/home';

export const routes: Routes = [
  {
    path: '',
    component: Home,
  },
  {
    path: 'buscar',
    loadComponent: () => import('./pages/search/search').then((m) => m.SearchPage),
    title: 'Buscar preços | TaQuanto',
  },
  {
    path: 'favoritos',
    loadComponent: () => import('./pages/favorites/favorites').then((m) => m.FavoritesPage),
    title: 'Favoritos | TaQuanto',
  },
];
