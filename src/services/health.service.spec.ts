import { HealthService } from './health.service';

describe('HealthService', () => {
  let service: HealthService;

  beforeEach(() => {
    service = new HealthService();
  });

  it('returns live status', () => {
    expect(service.live()).toEqual({ status: 'ok' });
  });

  it('returns ready status', () => {
    expect(service.ready()).toEqual({ status: 'ok' });
  });
});
