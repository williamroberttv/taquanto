import { Component, computed, input, output } from '@angular/core';
import { Pagination } from '../../services/taquanto-api';

@Component({
  selector: 'app-search-pagination',
  template: `
    <nav class="mt-6 flex justify-center" aria-label="Paginação dos resultados">
      <div class="join">
        <button
          type="button"
          class="btn btn-square join-item min-h-11 w-11"
          aria-label="Página anterior"
          [disabled]="pagination().first_page || loading()"
          (click)="pageSelected.emit(pagination().page - 1)"
        >
          ‹
        </button>
        @for (page of pageNumbers(); track page) {
          <button
            type="button"
            class="btn btn-square join-item min-h-11 w-11"
            [class.btn-active]="page === pagination().page"
            [disabled]="loading()"
            [attr.aria-current]="page === pagination().page ? 'page' : null"
            [attr.aria-label]="'Página ' + page"
            (click)="pageSelected.emit(page)"
          >
            {{ page }}
          </button>
        }
        <button
          type="button"
          class="btn btn-square join-item min-h-11 w-11"
          aria-label="Próxima página"
          [disabled]="pagination().last_page || loading()"
          (click)="pageSelected.emit(pagination().page + 1)"
        >
          ›
        </button>
      </div>
    </nav>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class SearchPagination {
  readonly pagination = input.required<Pagination>();
  readonly loading = input.required<boolean>();
  readonly pageSelected = output<number>();

  protected readonly pageNumbers = computed(() => {
    const pagination = this.pagination();
    const count = Math.min(pagination.total_pages, 3);
    const start = Math.min(
      Math.max(1, pagination.page - 1),
      Math.max(1, pagination.total_pages - count + 1),
    );
    return Array.from({ length: count }, (_, index) => start + index);
  });
}
