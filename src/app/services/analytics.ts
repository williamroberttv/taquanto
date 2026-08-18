import { isPlatformBrowser } from '@angular/common';
import { NgZone, PLATFORM_ID, Service, inject } from '@angular/core';
import posthog, { type PostHog, type Properties } from 'posthog-js';
import { environment } from '../../environments/environment';

@Service()
export class Analytics {
  private readonly client: PostHog | null;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    const enabled =
      isPlatformBrowser(platformId) &&
      environment.posthogKey.startsWith('phc_') &&
      environment.posthogHost.startsWith('https://');

    this.client = enabled
      ? inject(NgZone).runOutsideAngular(() => this.initialize())
      : null;
  }

  capture(event: string, properties?: Properties): void {
    this.client?.capture(event, properties);
  }

  private initialize(): PostHog {
    posthog.init(environment.posthogKey, {
      api_host: environment.posthogHost,
      defaults: '2026-05-30',
      autocapture: false,
      capture_pageview: 'history_change',
      disable_session_recording: true,
      person_profiles: 'never',
    });
    return posthog;
  }
}
