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
    posthog.init.mockReset().mockReturnValue(posthog);
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
    );
  });

  it('does not initialize PostHog with an invalid host', () => {
    environment.posthogHost = 'http://us.i.posthog.com';

    TestBed.inject(Analytics);

    expect(posthog.init).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith('[Analytics] PostHog disabled: invalid host');
  });

  it('forwards custom events to PostHog', () => {
    const analytics = TestBed.inject(Analytics);

    analytics.capture('search_submitted', { query: 'arroz' });

    expect(posthog.capture).toHaveBeenCalledWith('search_submitted', {
      query: 'arroz',
    });
  });

  it('does not load PostHog during server rendering', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PLATFORM_ID, useValue: 'server' }],
    });

    TestBed.inject(Analytics).capture('search_submitted');

    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('reports initialization failures without breaking the application', () => {
    posthog.init.mockImplementationOnce(() => {
      throw new TypeError('SDK failed');
    });

    expect(() => TestBed.inject(Analytics)).not.toThrow();
    expect(console.warn).toHaveBeenCalledWith('[Analytics] Failed to initialize PostHog', {
      name: 'TypeError',
    });
  });
});
