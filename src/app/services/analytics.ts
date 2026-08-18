import { isPlatformBrowser } from '@angular/common';
import { NgZone, PLATFORM_ID, Service, inject } from '@angular/core';
import posthog, { type PostHog, type Properties } from 'posthog-js';
import { environment } from '../../environments/environment';

export type AnalyticsEvent =
  | 'search_submitted'
  | 'search_results_loaded'
  | 'result_detail_opened'
  | 'favorite_added'
  | 'favorite_removed';

@Service()
export class Analytics {
  private readonly client: PostHog | null;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    if (!isPlatformBrowser(platformId)) {
      this.client = null;
      return;
    }

    const tokenConfigured = environment.posthogKey.startsWith('phc_');
    if (!tokenConfigured) {
      console.warn('[Analytics] PostHog disabled: invalid project token');
      this.client = null;
      return;
    }

    if (!environment.posthogHost.startsWith('https://')) {
      console.warn('[Analytics] PostHog disabled: invalid host');
      this.client = null;
      return;
    }

    try {
      this.client = inject(NgZone).runOutsideAngular(() => this.initialize());
    } catch (error: unknown) {
      this.client = null;
      console.warn('[Analytics] Failed to initialize PostHog', {
        name: error instanceof Error ? error.name : typeof error,
      });
    }
  }

  capture(event: AnalyticsEvent, properties?: Properties): void {
    this.client?.capture(event, properties);
  }

  private initialize(): PostHog {
    return posthog.init(environment.posthogKey, {
      api_host: environment.posthogHost,
      defaults: '2026-05-30',
      autocapture: true,
      capture_pageview: 'history_change',
      disable_session_recording: false,
      person_profiles: 'never',
      session_recording: {
        maskAllInputs: true,
      },
    });
  }
}
