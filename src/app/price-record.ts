import { PriceRecord } from './services/taquanto-api';

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat('pt-BR', { currency: 'BRL', style: 'currency' }).format(cents / 100);
}

export function formatSaleValue(record: PriceRecord): string {
  return `${formatMoney(record.sale_value_cents)}${record.unit ? ` / ${record.unit}` : ''}`;
}

export function formatSaleDate(record: PriceRecord): string {
  const date = new Date(record.sold_at);
  if (Number.isNaN(date.getTime())) {
    return 'Data da venda não informada';
  }
  return `Venda em ${new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
    .format(date)
    .replace(', ', ' às ')}`;
}

export function locationLine(record: PriceRecord): string {
  return (
    [record.location.district, record.location.city, record.location.zip_code]
      .filter(Boolean)
      .join(' · ') || 'Localização textual não informada'
  );
}

export function recordCoordinates(record: PriceRecord): [number, number] | null {
  const latitude = normalizeCoordinate(record.location.latitude);
  const longitude = normalizeCoordinate(record.location.longitude);
  if (
    latitude === null ||
    longitude === null ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }
  return [latitude, longitude];
}

export function recordMapUrl(record: PriceRecord): string | null {
  const coordinates = recordCoordinates(record);
  if (!coordinates) {
    return null;
  }
  const [latitude, longitude] = coordinates;
  return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
}

function normalizeCoordinate(value: number | string | null): number | null {
  if (value === null || (typeof value === 'string' && value.trim() === '')) {
    return null;
  }
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}
