import { TestBed } from '@angular/core/testing';
import { environment } from '../environments/environment';
import { App } from './app';

const posthog = vi.hoisted(() => ({
  capture: vi.fn(),
  init: vi.fn(),
}));

vi.mock('posthog-js', () => ({ default: posthog }));

describe('App', () => {
  const originalEnvironment = { ...environment };

  beforeEach(async () => {
    Object.assign(environment, {
      posthogKey: 'phc_test',
      posthogHost: 'https://us.i.posthog.com',
    });
    posthog.init.mockClear();

    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => {
    Object.assign(environment, originalEnvironment);
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should initialize PostHog when the root component is created', () => {
    TestBed.createComponent(App);

    expect(posthog.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://us.i.posthog.com',
      defaults: '2026-05-30',
      autocapture: false,
      capture_pageview: 'history_change',
      disable_session_recording: true,
      person_profiles: 'never',
    });
  });

  it('should render the router outlet shell', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('router-outlet')).toBeTruthy();
  });
});
