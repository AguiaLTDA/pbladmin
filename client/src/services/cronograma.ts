import { apiRequest } from './api';
import { CRONOGRAMA_PBL_PADRAO, EtapaCronogramaPBL } from '../constants/academico';
import { useEffect, useState } from 'react';

export interface CronogramaPBLDados {
  periodo: string;
  totalAvaliativo: string;
  etapas: EtapaCronogramaPBL[];
  atualizadoEm?: string | null;
}

/**
 * Evento interno para a propagação imediata: quando a coordenação salva o
 * cronograma, toda peça montada na mesma aba redesenha na hora, sem esperar a
 * próxima sondagem. Outras abas/usuários pegam pelo intervalo de recarga.
 */
const EVENTO_CRONOGRAMA = 'pbl:cronograma-atualizado';

/** De quanto em quanto tempo uma tela aberta reconfere o cronograma. */
const INTERVALO_RECARGA_MS = 60_000;

export async function buscarCronograma(): Promise<CronogramaPBLDados> {
  const dados = await apiRequest<CronogramaPBLDados>('/cronograma');
  // Defesa contra resposta incompleta: o quadro nunca deve sumir das telas.
  return {
    periodo: dados?.periodo || CRONOGRAMA_PBL_PADRAO.periodo,
    totalAvaliativo: dados?.totalAvaliativo || CRONOGRAMA_PBL_PADRAO.totalAvaliativo,
    etapas: Array.isArray(dados?.etapas) && dados.etapas.length > 0 ? dados.etapas : CRONOGRAMA_PBL_PADRAO.etapas,
    atualizadoEm: dados?.atualizadoEm ?? null
  };
}

export async function salvarCronograma(dados: {
  periodo: string;
  totalAvaliativo: string;
  etapas: EtapaCronogramaPBL[];
}): Promise<{ message: string }> {
  const resposta = await apiRequest<{ message: string }>('/cronograma', {
    method: 'PUT',
    body: JSON.stringify(dados)
  });
  window.dispatchEvent(new CustomEvent(EVENTO_CRONOGRAMA));
  return resposta;
}

/**
 * Cronograma vigente para quem só quer exibi-lo. Recarrega sozinho quando o
 * admin salva (evento), quando a aba volta ao foco e a cada minuto — é isso que
 * faz a edição da coordenação aparecer para professor e aluno sem novo login.
 */
export function useCronograma(): { dados: CronogramaPBLDados; carregando: boolean } {
  const [dados, setDados] = useState<CronogramaPBLDados>(() => ({
    ...CRONOGRAMA_PBL_PADRAO,
    atualizadoEm: null
  }));
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let ativo = true;

    const recarregar = () => {
      buscarCronograma()
        .then((res) => {
          if (ativo) setDados(res);
        })
        // Sem toast: o quadro cai no padrão de fábrica e a tela segue utilizável.
        .catch(() => undefined)
        .finally(() => {
          if (ativo) setCarregando(false);
        });
    };

    recarregar();

    const aoVoltarAoFoco = () => {
      if (document.visibilityState === 'visible') recarregar();
    };

    window.addEventListener(EVENTO_CRONOGRAMA, recarregar);
    window.addEventListener('focus', recarregar);
    document.addEventListener('visibilitychange', aoVoltarAoFoco);
    const timer = window.setInterval(recarregar, INTERVALO_RECARGA_MS);

    return () => {
      ativo = false;
      window.removeEventListener(EVENTO_CRONOGRAMA, recarregar);
      window.removeEventListener('focus', recarregar);
      document.removeEventListener('visibilitychange', aoVoltarAoFoco);
      window.clearInterval(timer);
    };
  }, []);

  return { dados, carregando };
}
