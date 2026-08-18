import { isPlatformBrowser } from '@angular/common';
import { NgZone, PLATFORM_ID, Service, inject } from '@angular/core';
import type { PostHog, Properties } from 'posthog-js';
import { environment } from '../../environments/environment';

@Service()
export class Analytics {
  private readonly client: Promise<PostHog | null>;

  constructor() {
    const platformId = inject(PLATFORM_ID);
    const enabled =
      isPlatformBrowser(platformId) &&
      environment.posthogKey.startsWith('phc_') &&
      environment.posthogHost.startsWith('https://');

    this.client = enabled
      ? inject(NgZone).runOutsideAngular(() => this.initialize().catch(() => null))
      : Promise.resolve(null);
  }

  capture(event: string, properties?: Properties): void {
    void this.client.then((client) => client?.capture(event, properties));
  }

  private async initialize(): Promise<PostHog> {
    const { default: posthog } = await import('posthog-js');
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
