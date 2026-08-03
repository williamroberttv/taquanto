import { afterNextRender, Component, ElementRef, input, output, viewChild } from '@angular/core';

@Component({
  selector: 'app-location-permission-dialog',
  template: `
    <dialog
      #dialog
      class="modal"
      aria-labelledby="location-permission-title"
      aria-describedby="location-permission-description"
      (cancel)="cancel($event)"
    >
      <section class="modal-box max-w-md">
        <h2 id="location-permission-title" class="text-xl font-bold">
          Usar sua localização atual?
        </h2>
        <p
          id="location-permission-description"
          class="mt-3 text-sm leading-6 text-[var(--tq-muted)]"
        >
          Sua posição será enviada à API para buscar vendas próximas. Neste navegador, salvaremos
          apenas sua confirmação, não as coordenadas.
        </p>
        <div class="modal-action">
          <button
            type="button"
            class="btn btn-ghost"
            [disabled]="loading()"
            (click)="declined.emit()"
          >
            Agora não
          </button>
          <button
            type="button"
            class="btn btn-primary"
            [disabled]="loading()"
            (click)="confirmed.emit()"
          >
            @if (loading()) {
              <span class="loading loading-spinner loading-sm" aria-hidden="true"></span>
              Obtendo localização
            } @else {
              Permitir localização
            }
          </button>
        </div>
      </section>
      <form method="dialog" class="modal-backdrop">
        <button
          aria-label="Cancelar uso da localização"
          [disabled]="loading()"
          (click)="declined.emit()"
        >
          Cancelar
        </button>
      </form>
    </dialog>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class LocationPermissionDialog {
  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  readonly loading = input(false);
  readonly confirmed = output<void>();
  readonly declined = output<void>();

  constructor() {
    afterNextRender(() => this.dialog().nativeElement.showModal?.());
  }

  protected cancel(event: Event): void {
    event.preventDefault();
    if (!this.loading()) {
      this.declined.emit();
    }
  }
}
