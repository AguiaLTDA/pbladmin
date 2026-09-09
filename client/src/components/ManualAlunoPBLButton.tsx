import React, { useEffect, useState } from 'react';
import { apiRequest } from '../services/api';
import { InstitutionalFile } from '../types';
import { VisualizadorArquivo } from './VisualizadorArquivo';
import { ArrowRight, BookOpen } from 'lucide-react';

/**
 * Botão "Manual do Aluno PBL", usado nos dashboards do aluno e do professor.
 * O arquivo é o mesmo para as duas turmas de usuário — registrado pelo admin
 * como arquivo institucional (chave 'MANUAL_ALUNO_PBL', ver server/src/scripts/
 * uploadManualAlunoPBL.ts). Some silenciosamente se o arquivo ainda não tiver
 * sido cadastrado.
 */
export const ManualAlunoPBLButton: React.FC = () => {
  const [manual, setManual] = useState<InstitutionalFile | null>(null);
  const [mostrarVisualizador, setMostrarVisualizador] = useState(false);

  useEffect(() => {
    apiRequest<InstitutionalFile | null>('/files/institutional/MANUAL_ALUNO_PBL')
      .then((res) => setManual(res))
      .catch(() => setManual(null));
  }, []);

  if (!manual) return null;

  return (
    <>
      <button onClick={() => setMostrarVisualizador(true)} className="btn btn-secondary justify-between">
        <span className="flex items-center gap-2">
          <BookOpen size={16} /> Manual do Aluno PBL
        </span>
        <ArrowRight size={16} />
      </button>

      {mostrarVisualizador && (
        <VisualizadorArquivo
          arquivoId={manual.arquivo_id}
          nomeArquivo={manual.nome_original}
          mimeType={manual.mime_type}
          descricao="Manual do Aluno PBL — clique em Baixar para salvar o PDF."
          onClose={() => setMostrarVisualizador(false)}
        />
      )}
    </>
  );
};
