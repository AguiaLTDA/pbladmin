import React, { useEffect, useState } from 'react';
import { Pencil } from 'lucide-react';
import { apiRequest } from '../../services/api';
import {
  AvaliacaoBanca,
  FormularioAvaliacaoBanca,
  formatarNota,
  mediaCriterios,
  rotuloStatusBanca
} from '../../components/FormularioAvaliacaoBanca';

/** Formulário da banca + lista das avaliações que o próprio usuário já enviou. */
export const AvaliacaoBancaPainel: React.FC<{ mostrarCabecalho?: boolean }> = ({ mostrarCabecalho = true }) => {
  const [minhas, setMinhas] = useState<AvaliacaoBanca[]>([]);
  const [editando, setEditando] = useState<AvaliacaoBanca | null>(null);

  const carregar = () =>
    apiRequest<AvaliacaoBanca[]>('/banca/minhas')
      .then((r) => setMinhas(Array.isArray(r) ? r : []))
      .catch(() => setMinhas([]));

  useEffect(() => {
    carregar();
  }, []);

  return (
    <div>
      {mostrarCabecalho && (
        <div className="mb-4">
          <h2 style={{ fontSize: '1.4rem' }}>Avaliação da Banca</h2>
          <p className="text-muted text-sm">
            Preencha um formulário por grupo avaliado. Se enviar de novo para o mesmo grupo, a avaliação anterior é
            substituída.
          </p>
        </div>
      )}

      {editando && (
        <div className="card mb-4" style={{ padding: '0.85rem 1rem' }}>
          Editando a avaliação de <strong>{editando.grupo_nome}</strong> ({editando.turma_nome}).
        </div>
      )}

      <FormularioAvaliacaoBanca
        editando={editando}
        onSalvo={() => {
          setEditando(null);
          carregar();
        }}
      />

      <div className="card mt-4">
        <h3 className="font-bold mb-3">Minhas avaliações enviadas ({minhas.length})</h3>
        {minhas.length === 0 ? (
          <p className="text-muted text-sm mb-0">Nenhuma avaliação enviada ainda.</p>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Turma</th>
                  <th>Nota média</th>
                  <th>Nota final</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {minhas.map((a) => (
                  <tr key={a.id}>
                    <td>{a.grupo_nome}</td>
                    <td>{a.turma_nome}</td>
                    <td>{formatarNota(mediaCriterios(a) * 0.3)}</td>
                    <td>{formatarNota(a.nota_final)}</td>
                    <td>{rotuloStatusBanca(a.status)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setEditando(a);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <Pencil size={14} /> Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const AvaliacaoBancaProfessorView: React.FC = () => <AvaliacaoBancaPainel />;
