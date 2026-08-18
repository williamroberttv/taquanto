import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { PostHogConfig, PostHogInterface } from 'posthog-js';
import { environment } from '../../environments/environment';
import { Analytics } from './analytics';

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  has_opted_out_capturing: vi.fn(() => false),
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
    posthog.has_opted_out_capturing.mockClear();
    posthog.init.mockReset().mockReturnValue(posthog);
    vi.spyOn(console, 'info').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    Object.assign(environment, originalEnvironment);
    vi.restoreAllMocks();
  });

  it('initializes PostHog in the browser with a valid configuration', () => {
    TestBed.inject(Analytics);

    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://us.i.posthog.com',
        defaults: '2026-05-30',
        autocapture: true,
        capture_pageview: 'history_change',
        disable_session_recording: false,
        person_profiles: 'never',
        session_recording: { maskAllInputs: true },
        loaded: expect.any(Function),
      }),
    );
  });

  it('does not initialize PostHog with an invalid token', () => {
    environment.posthogKey = 'https://us.i.posthog.com';
    environment.posthogHost = 'phc_misconfigured';

    TestBed.inject(Analytics);

    expect(posthog.init).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      '[Analytics] PostHog disabled: invalid project token',
      { host: '[redacted project token]', tokenConfigured: false },
    );
  });

  it('does not initialize PostHog with an invalid host', () => {
    environment.posthogHost = 'http://us.i.posthog.com';

    TestBed.inject(Analytics);

    expect(posthog.init).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[Analytics] PostHog disabled: invalid host', {
      host: environment.posthogHost,
      tokenConfigured: true,
    });
  });

  it('forwards custom events to PostHog', () => {
    const analytics = TestBed.inject(Analytics);

    analytics.capture('product_search_submitted', { query: 'arroz' });

    expect(posthog.capture).toHaveBeenCalledWith('product_search_submitted', {
      query: 'arroz',
    });
  });

  it('captures the diagnostic event when PostHog loads', () => {
    TestBed.inject(Analytics);
    const config = posthog.init.mock.calls[0]?.[1] as PostHogConfig;

    config.loaded(posthog as unknown as PostHogInterface);

    expect(posthog.has_opted_out_capturing).toHaveBeenCalled();
    expect(console.info).toHaveBeenCalledWith('[Analytics] opted out: false');
    expect(posthog.capture).toHaveBeenCalledWith('posthog_init_test', {
      source: 'frontend',
    });
  });

  it('does not load PostHog during server rendering', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    TestBed.inject(Analytics).capture('landing_cta_clicked');

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('reports initialization failures without breaking the application', () => {
    posthog.init.mockImplementationOnce(() => {
      throw new TypeError('SDK failed');
    });

    expect(() => TestBed.inject(Analytics)).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith(
      '[Analytics] Failed to initialize PostHog',
      { name: 'TypeError' },
    );
  });
});
