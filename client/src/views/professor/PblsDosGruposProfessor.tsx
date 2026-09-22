import React, { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { VisualizadorArquivo } from '../../components/VisualizadorArquivo';
import { ComentariosMaterial } from '../../components/ComentariosMaterial';
import { rotuloTipoDocumento } from '../../constants/academico';
import { Users, Eye, RefreshCw, MessageSquare, FileText, AlertTriangle } from 'lucide-react';

interface MaterialDoGrupo {
  atividadeId: number;
  titulo: string;
  arquivoId: number;
  arquivoNome: string;
  tipoDocumento: string | null;
  totalComentarios: number;
  criadoEm: string;
}

interface GrupoComPbl {
  grupoId: number;
  grupoNome: string;
  totalIntegrantes: number;
  materiais: MaterialDoGrupo[];
}

interface TurmaComGrupos {
  turmaId: number;
  turmaCodigo: string;
  turmaNome: string;
  cursoNome: string | null;
  grupos: GrupoComPbl[];
}

/**
 * Os PBLs por grupo das turmas que o docente leciona.
 *
 * É a única tela do portal em que um professor alcança mais de um grupo de uma
 * vez, e ela existe por causa disso: o caso PBL é individual por grupo, mas
 * quem acompanha a turma precisa ver o conjunto para comparar andamento e
 * perceber quem ficou sem material. O recorte vem do servidor, pelo vínculo
 * ativo com a turma — a tela não escolhe o que mostrar, apenas organiza.
 *
 * Os grupos sem material aparecem em destaque em vez de serem omitidos: a
 * ausência é o que exige ação do docente.
 */
export const PblsDosGruposProfessorView: React.FC = () => {
  const { showToast } = useToast();
  const [turmas, setTurmas] = useState<TurmaComGrupos[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [emFoco, setEmFoco] = useState<{ material: MaterialDoGrupo; turma: TurmaComGrupos; grupo: GrupoComPbl } | null>(
    null
  );
  // Comentar é ação deliberada: a caixa abre por grupo, a pedido, para a lista
  // não virar um mural aberto de todas as turmas ao mesmo tempo.
  const [comentandoGrupo, setComentandoGrupo] = useState<number | null>(null);

  const carregar = () => {
    setCarregando(true);
    apiRequest<TurmaComGrupos[]>('/files/meus-grupos-pbl')
      .then(setTurmas)
      .catch((err: any) => showToast(err.message || 'Erro ao carregar os PBLs dos seus grupos.', 'error'))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resumo = useMemo(() => {
    let grupos = 0;
    let comMaterial = 0;
    for (const t of turmas) {
      for (const g of t.grupos) {
        grupos++;
        if (g.materiais.length > 0) comMaterial++;
      }
    }
    return { turmas: turmas.length, grupos, comMaterial, semMaterial: grupos - comMaterial };
  }, [turmas]);

  if (carregando) {
    return <div className="text-center py-8 text-muted">Carregando os PBLs dos seus grupos...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-2" style={{ flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem' }}>PBLs dos Meus Grupos</h2>
          <p className="text-muted text-sm">
            O caso de estudo entregue a cada grupo das turmas em que você leciona. Cada grupo recebe um caso
            diferente — o comentário que você escrever aqui é lido apenas pelos integrantes daquele grupo.
          </p>
        </div>
        <button className="btn btn-outline" onClick={carregar} title="Recarregar">
          <RefreshCw size={16} /> Atualizar
        </button>
      </div>

      {turmas.length === 0 ? (
        <div className="card text-center py-8">
          <Users size={32} className="text-muted" style={{ margin: '0 auto 8px' }} />
          <p className="text-muted">
            Você ainda não tem turmas com grupos cadastrados. Assim que a coordenação vincular você a uma turma
            com grupos, os casos aparecem aqui.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2 mb-4 text-sm text-muted" style={{ flexWrap: 'wrap' }}>
            <span>{resumo.turmas} turma(s)</span>
            <span>·</span>
            <span>{resumo.grupos} grupo(s)</span>
            <span>·</span>
            <span>{resumo.comMaterial} com caso PBL</span>
            {resumo.semMaterial > 0 && (
              <>
                <span>·</span>
                <span style={{ color: 'var(--cor-alerta, #b45309)' }}>{resumo.semMaterial} sem caso</span>
              </>
            )}
          </div>

          {turmas.map((turma) => (
            <div key={turma.turmaId} className="card mb-4">
              <div className="mb-3">
                <h3 style={{ fontSize: '1.05rem', marginBottom: 2 }}>
                  {turma.turmaNome} <span className="text-muted text-sm">({turma.turmaCodigo})</span>
                </h3>
                {turma.cursoNome && <p className="text-muted text-sm">{turma.cursoNome}</p>}
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Grupo</th>
                      <th>Integrantes</th>
                      <th>Caso PBL</th>
                      <th style={{ textAlign: 'right' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {turma.grupos.map((grupo) => {
                      const material = grupo.materiais[0] || null;
                      return (
                        <React.Fragment key={grupo.grupoId}>
                          <tr>
                            <td>
                              <strong>{grupo.grupoNome}</strong>
                            </td>
                            <td className="text-sm text-muted">{grupo.totalIntegrantes}</td>
                            <td>
                              {material ? (
                                <div className="flex items-center gap-2">
                                  <FileText size={15} className="text-muted" />
                                  <span className="text-sm" title={material.arquivoNome}>
                                    {material.arquivoNome}
                                  </span>
                                  {material.tipoDocumento && (
                                    <span className="badge">{rotuloTipoDocumento(material.tipoDocumento)}</span>
                                  )}
                                </div>
                              ) : (
                                <span className="flex items-center gap-2 text-sm" style={{ color: 'var(--cor-alerta, #b45309)' }}>
                                  <AlertTriangle size={15} /> Nenhum caso enviado a este grupo
                                </span>
                              )}
                              {grupo.materiais.length > 1 && (
                                <p className="text-muted text-sm" style={{ marginTop: 4 }}>
                                  + {grupo.materiais.length - 1} material(is) anterior(es)
                                </p>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                              {material && (
                                <>
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() => setEmFoco({ material, turma, grupo })}
                                    title="Abrir o caso na plataforma"
                                  >
                                    <Eye size={14} /> Abrir
                                  </button>{' '}
                                  <button
                                    className="btn btn-sm btn-outline"
                                    onClick={() =>
                                      setComentandoGrupo(comentandoGrupo === grupo.grupoId ? null : grupo.grupoId)
                                    }
                                    title="Comentar com este grupo"
                                  >
                                    <MessageSquare size={14} />{' '}
                                    {material.totalComentarios > 0 ? material.totalComentarios : ''} Comentar
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>

                          {material && comentandoGrupo === grupo.grupoId && (
                            <tr>
                              <td colSpan={4} style={{ background: 'var(--cor-fundo-suave, #fafafa)' }}>
                                <p className="text-muted text-sm mb-2">
                                  Este comentário fica visível apenas para os {grupo.totalIntegrantes} integrante(s)
                                  de <strong>{grupo.grupoNome}</strong>.
                                </p>
                                <ComentariosMaterial
                                  arquivoId={material.arquivoId}
                                  turmaId={turma.turmaId}
                                  grupoId={grupo.grupoId}
                                  podeComentar
                                />
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {emFoco && (
        <VisualizadorArquivo
          arquivoId={emFoco.material.arquivoId}
          nomeArquivo={emFoco.material.arquivoNome}
          mimeType="application/pdf"
          descricao={[emFoco.turma.cursoNome, emFoco.turma.turmaNome, emFoco.grupo.grupoNome]
            .filter(Boolean)
            .join(' • ')}
          onClose={() => setEmFoco(null)}
        />
      )}
    </div>
  );
};
