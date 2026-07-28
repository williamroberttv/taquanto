import { HttpErrorResponse } from '@angular/common/http';
import { Service, inject } from '@angular/core';
import { Observable, Subscription, TimeoutError } from 'rxjs';
import { PricePageParams, PriceSearchResponse, TaquantoApi } from './taquanto-api';

export type PricePollingEvent =
  | { kind: 'response'; response: PriceSearchResponse; revalidation: boolean }
  | { kind: 'exhausted' };

@Service()
export class PricePolling {
  private readonly api = inject(TaquantoApi);
  private readonly intervalMs = 5000;
  private readonly durationMs = 120000;
  private readonly maxRevalidations = this.durationMs / this.intervalMs;

  poll(query: string, params: PricePageParams): Observable<PricePollingEvent> {
    return new Observable((subscriber) => {
      const deadline = Date.now() + this.durationMs;
      let request: Subscription | null = null;
      let timer: ReturnType<typeof setTimeout> | null = null;
      let revalidations = 0;
      let revalidation = false;

      const exhaust = () => {
        subscriber.next({ kind: 'exhausted' });
        subscriber.complete();
      };
      const schedule = () => {
        if (revalidations >= this.maxRevalidations || Date.now() >= deadline) {
          exhaust();
          return;
        }
        timer = setTimeout(
          () => {
            timer = null;
            revalidation = true;
            revalidations += 1;
            fetch();
          },
          Math.min(this.intervalMs, deadline - Date.now()),
        );
      };
      const fetch = () => {
        request = this.api.prices(query, params).subscribe({
          next: (response) => {
            subscriber.next({ kind: 'response', response, revalidation });
            if (response.cacheStatus === 'HIT') {
              subscriber.complete();
            } else {
              schedule();
            }
          },
          error: (error: unknown) => {
            if (this.isTransient(error)) {
              schedule();
            } else {
              subscriber.error(error);
            }
          },
        });
      };

      fetch();
      return () => {
        request?.unsubscribe();
        if (timer) {
          clearTimeout(timer);
        }
      };
    });
  }

  private isTransient(error: unknown): boolean {
    return (
      error instanceof TimeoutError ||
      (error instanceof HttpErrorResponse &&
        (error.status === 0 ||
          error.status === 502 ||
          error.status === 503 ||
          error.status === 504))
    );
  }
}
