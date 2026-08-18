import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { environment } from '../../environments/environment';
import { Analytics } from './analytics';

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthog }));

describe('Analytics', () => {
  const originalEnvironment = { ...environment };

  beforeEach(() => {
    Object.assign(environment, {
      posthogKey: 'phc_test',
      posthogHost: 'https://us.i.posthog.com',
    });
    posthog.capture.mockClear();
    posthog.init.mockClear();
  });

  afterEach(() => {
    Object.assign(environment, originalEnvironment);
  });

  it('initializes privacy-conscious browser analytics and captures events', async () => {
    const analytics = TestBed.inject(Analytics);

    analytics.capture('product_search_submitted', { query: 'arroz' });

    await vi.waitFor(() => expect(posthog.capture).toHaveBeenCalled());
    expect(posthog.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      autocapture: false,
      capture_pageview: 'history_change',
      disable_session_recording: true,
      person_profiles: 'never',
    });
    expect(posthog.capture).toHaveBeenCalledWith('product_search_submitted', {
      query: 'arroz',
    });
  });

  it('does not load PostHog during server rendering', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    TestBed.inject(Analytics).capture('landing_cta_clicked');
    await Promise.resolve();

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });
});
