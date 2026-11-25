import { describe, expect, it } from 'vitest';
import { healthStatus } from '../services/health';

describe('status de saúde da API', () => {
  it('informa o commit do deploy do Render', () => {
    const agora = new Date('2026-11-25T18:00:00Z');
    expect(healthStatus({ RENDER_GIT_COMMIT: 'dcce5031234567890abcdef' }, agora)).toEqual({
      status: 'OK', system: 'Plataforma PBL Backend API', commit: 'dcce5031234567890abcdef', timestamp: agora
    });
  });

  it('aceita GIT_COMMIT fora do Render e devolve null sem commit conhecido', () => {
    expect(healthStatus({ GIT_COMMIT: 'abc123' }).commit).toBe('abc123');
    expect(healthStatus({}).commit).toBeNull();
  });
});
