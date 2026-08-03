import { isPlatformBrowser } from '@angular/common';
import { Component, PLATFORM_ID, computed, inject, input, output, signal } from '@angular/core';
import { LocationPermissionDialog } from '../../components/location-permission-dialog/location-permission-dialog';
import { MunicipalitySelect } from '../../components/municipality-select/municipality-select';
import { MunicipalitySelection } from '../../municipalities';
import { GeographicSearch } from '../../services/taquanto-api';
import { SEARCH_PERIODS } from './search.models';

@Component({
  selector: 'app-search-filters',
  imports: [LocationPermissionDialog, MunicipalitySelect],
  host: { class: 'location-filter' },
  template: `
    <fieldset class="period-filter fieldset">
      <legend class="fieldset-legend">
        Período
        <span class="text-error" aria-hidden="true">*</span>
        <span class="sr-only">(obrigatório)</span>
      </legend>
      <select
        id="search-period"
        class="select select-sm min-h-10 w-full"
        aria-label="Período da consulta"
        name="days"
        required
        [value]="days()"
        (change)="selectPeriod($event)"
      >
        @for (period of periods; track period.days) {
          <option [value]="period.days">{{ period.label }}{{ period.hint }}</option>
        }
      </select>
    </fieldset>

    @if (!locationMode()) {
      <app-municipality-select
        [municipality]="municipality()"
        (municipalityChange)="municipalityChange.emit($event)"
      />
    }

    @if (locationMode()) {
      <fieldset class="radius-filter fieldset">
        <legend class="fieldset-legend">
          Raio
          <span class="text-error" aria-hidden="true">*</span>
          <span class="sr-only">(obrigatório)</span>
        </legend>
        <select
          id="search-radius"
          class="select select-sm min-h-10 w-full"
          aria-label="Raio da busca"
          name="radius"
          required
          [value]="radius()"
          (change)="selectRadius($event)"
        >
          @for (option of radii; track option) {
            <option [value]="option">{{ option }} km</option>
          }
        </select>
      </fieldset>
    }

    <fieldset class="proximity-filter fieldset toggle-field">
      <legend class="fieldset-legend">Proximidade</legend>
      <label class="label min-h-10 cursor-pointer justify-start gap-2" for="use-location">
        <input
          id="use-location"
          type="checkbox"
          class="toggle toggle-primary toggle-sm"
          [checked]="locationMode()"
          [disabled]="locating()"
          (change)="toggleLocation($event)"
        />
        Buscar perto de mim
      </label>
    </fieldset>

    @if (locationError()) {
      <p class="filter-message text-sm font-semibold text-error" role="alert">
        {{ locationError() }}
      </p>
    }

    @if (permissionDialogVisible()) {
      <app-location-permission-dialog
        [loading]="locating()"
        (confirmed)="confirmLocation()"
        (declined)="declineLocation()"
      />
    }
  `,
  styles: `
    :host {
      display: contents;
    }

    app-municipality-select {
      min-width: 0;
    }

    .period-filter,
    .radius-filter {
      min-width: 0;
    }

    .toggle-field {
      min-width: 0;
    }

    .filter-message {
      grid-column: 1 / -1;
    }
  `,
})
export class SearchFilters {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly consentKey = 'taquanto:location-consent';

  readonly municipality = input.required<MunicipalitySelection>();
  readonly days = input.required<number>();
  readonly location = input.required<GeographicSearch | null>();
  readonly municipalityChange = output<MunicipalitySelection>();
  readonly daysChange = output<number>();
  readonly locationChange = output<GeographicSearch | null>();
  readonly locationPendingChange = output<boolean>();

  protected readonly locating = signal(false);
  protected readonly locationError = signal<string | null>(null);
  protected readonly permissionDialogVisible = signal(false);
  protected readonly requestingLocation = signal(false);
  protected readonly selectedRadius = signal(5);
  protected readonly periods = SEARCH_PERIODS;
  protected readonly radii = [5, 10, 15] as const;
  protected readonly locationMode = computed(
    () => this.requestingLocation() || this.location() !== null,
  );
  protected readonly radius = computed(() => this.location()?.radius ?? this.selectedRadius());

  protected selectPeriod(event: Event): void {
    this.daysChange.emit(Number((event.target as HTMLSelectElement).value));
  }

  protected toggleLocation(event: Event): void {
    if (!(event.target as HTMLInputElement).checked) {
      this.declineLocation();
      return;
    }

    this.requestLocation();
  }

  requestLocation(radius = this.radius()): void {
    if (this.radii.includes(radius as (typeof this.radii)[number])) {
      this.selectedRadius.set(radius);
    }
    if (this.locating() || this.permissionDialogVisible()) {
      return;
    }
    this.locationError.set(null);
    this.requestingLocation.set(true);
    this.locationPendingChange.emit(true);
    if (this.hasConsent()) {
      this.locate();
    } else {
      this.permissionDialogVisible.set(true);
    }
  }

  validateLocationPermission(): boolean {
    if (!this.locationMode()) {
      return true;
    }
    if (this.hasConsent() && this.location() !== null) {
      return true;
    }
    this.requestLocation();
    return false;
  }

  protected confirmLocation(): void {
    try {
      localStorage.setItem(this.consentKey, 'true');
    } catch {
      // Consent still applies to this visit when storage is unavailable.
    }
    this.locate();
  }

  protected declineLocation(): void {
    this.locating.set(false);
    this.permissionDialogVisible.set(false);
    this.requestingLocation.set(false);
    this.locationPendingChange.emit(false);
    this.locationChange.emit(null);
  }

  protected selectRadius(event: Event): void {
    const radius = Number((event.target as HTMLSelectElement).value);
    if (!this.radii.includes(radius as (typeof this.radii)[number])) {
      return;
    }
    this.selectedRadius.set(radius);
    const location = this.location();
    if (location) {
      this.locationChange.emit({ ...location, radius });
    }
  }

  private locate(): void {
    if (!isPlatformBrowser(this.platformId) || !navigator.geolocation) {
      this.failLocation('A localização não está disponível neste navegador.');
      return;
    }

    this.locating.set(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!this.validCoordinates(coords.latitude, coords.longitude)) {
          this.failLocation('O navegador retornou uma localização inválida.');
          return;
        }
        this.locating.set(false);
        this.permissionDialogVisible.set(false);
        this.requestingLocation.set(false);
        this.locationPendingChange.emit(false);
        this.locationChange.emit({
          latitude: coords.latitude,
          longitude: coords.longitude,
          radius: this.radius(),
        });
      },
      () =>
        this.failLocation(
          'Não foi possível obter sua localização. Verifique a permissão do navegador.',
        ),
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 10_000 },
    );
  }

  private failLocation(message: string): void {
    this.locating.set(false);
    this.permissionDialogVisible.set(false);
    this.requestingLocation.set(false);
    this.locationPendingChange.emit(false);
    this.locationError.set(message);
    this.locationChange.emit(null);
  }

  private hasConsent(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    try {
      return localStorage.getItem(this.consentKey) === 'true';
    } catch {
      return false;
    }
  }

  private validCoordinates(latitude: number, longitude: number): boolean {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    );
  }
}
