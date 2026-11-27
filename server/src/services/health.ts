/**
 * Resposta do /health. `commit` mostra qual versão está no ar: o Render define
 * RENDER_GIT_COMMIT em cada deploy; fora dele, GIT_COMMIT pode ser definido à mão.
 */
export function healthStatus(env: NodeJS.ProcessEnv = process.env, agora: Date = new Date()) {
  return {
    status: 'OK',
    system: 'Plataforma PBL Backend API',
    commit: env.RENDER_GIT_COMMIT || env.GIT_COMMIT || null,
    timestamp: agora
  };
}
