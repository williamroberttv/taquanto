import { PriceRecord } from './services/taquanto-api';

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(cents / 100);
}

export function formatSaleValue(record: PriceRecord): string {
  return `${formatMoney(record.sale_value_cents)}${record.unit ? ` / ${record.unit}` : ''}`;
}

export function formatAddress(address: string): string {
  const normalized = address
    .trim()
    .replace(/\s*[,;-]\s*macei[oó](?!\p{L}).*$/iu, '')
    .replace(/\s*[,;-]?\s*cep\s*:?\s*\d{5}-?\d{3}.*$/iu, '')
    .trim();
  return normalized ? formatTitle(normalized) : 'Endereço não informado';
}

export function formatTitle(value: string): string {
  return value
    .normalize('NFC')
    .toLocaleLowerCase('pt-BR')
    .replace(/(^|[^\p{L}\p{N}])\p{L}/gu, (letter) => letter.toLocaleUpperCase('pt-BR'));
}

export function formatSaleTime(record: PriceRecord): string {
  const date = new Date(record.sold_at);
  if (Number.isNaN(date.getTime())) {
    return 'Horário não informado';
  }
  const elapsedSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const [value, unit]: [number, Intl.RelativeTimeFormatUnit] =
    Math.abs(elapsedSeconds) < 60
      ? [0, 'second']
      : Math.abs(elapsedSeconds) < 3600
        ? [Math.round(elapsedSeconds / 60), 'minute']
        : Math.abs(elapsedSeconds) < 86400
          ? [Math.round(elapsedSeconds / 3600), 'hour']
          : [Math.round(elapsedSeconds / 86400), 'day'];
  const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' }).format(value, unit);
  return relative[0].toLocaleUpperCase('pt-BR') + relative.slice(1);
}

export function recordCoordinates(record: PriceRecord): [number, number] | null {
  const latitude = normalizeCoordinate(record.location.latitude);
  const longitude = normalizeCoordinate(record.location.longitude);
  if (
    latitude === null ||
    longitude === null ||
    (latitude === 0 && longitude === 0) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return [latitude, longitude];
}

function normalizeCoordinate(value: number | string | null): number | null {
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}
