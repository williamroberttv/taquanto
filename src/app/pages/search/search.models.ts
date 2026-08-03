import { MunicipalitySelection } from '../../components/municipality-map/municipality-map';

export interface RecentSearch {
  query: string;
  municipality: MunicipalitySelection;
  days: number;
}

export const SEARCH_PERIODS = [
  { days: 1, label: 'Últimas 24 horas', hint: ' (mais rápido)' },
  { days: 3, label: 'Últimos 3 dias', hint: '' },
  { days: 7, label: '1 semana', hint: '' },
  { days: 10, label: 'Últimos 10 dias', hint: '' },
] as const;
