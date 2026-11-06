import React, { useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { VisualizadorArquivo } from './VisualizadorArquivo';

export const ComunicadoPBLEscrito: React.FC = () => {
  const [visualizarTemplate, setVisualizarTemplate] = useState(false);
  return (
    <section className="card" aria-labelledby="comunicado-pbl-escrito" style={{ marginBottom: '1.5rem' }}>
      <div className="flex items-start gap-2">
        <FileText size={22} color="var(--primary)" aria-hidden="true" />
        <div style={{ minWidth: 0, flex: '1 1 220px' }}>
          <h3 id="comunicado-pbl-escrito" className="font-bold" style={{ margin: '0 0 0.4rem' }}>
            Comunicado — Entrega do PBL escrito
          </h3>
          <p className="text-muted text-sm" style={{ margin: '0 0 0.85rem' }}>
            O PBL escrito deverá ser entregue em formato de relatório. O uso do Template de relatório disponibilizado abaixo é opcional. Esta orientação aplica-se à etapa de entrega do PBL escrito. O prazo foi prorrogado até 10/11/2026, às 23h59 (horário de Brasília). Envios de 05/11 a 10/11 terão desconto de 20% na nota do PBL escrito. Entregas feitas até 04/11 e a nota da apresentação oral permanecem sem desconto.
          </p>
          <div className="flex items-center gap-2" style={{ flexWrap: 'wrap' }}>
            <span className="flex items-center gap-2 text-sm" style={{ minWidth: 0, flex: '1 1 180px' }}>
              <FileText size={16} aria-hidden="true" />
              Template de relatório (.docx)
            </span>
            <button
              className="btn btn-secondary btn-sm flex items-center gap-2"
              onClick={() => setVisualizarTemplate(true)}
              aria-label="Ver Template de relatório"
            >
              <Eye size={16} aria-hidden="true" />
              Ver
            </button>
            <a
              className="btn btn-secondary btn-sm flex items-center gap-2"
              href={`${import.meta.env.BASE_URL}documentos/template-de-relatorio.docx`}
              download="template-de-relatorio.docx"
              aria-label="Baixar Template de relatório (DOCX)"
            >
              <Download size={16} aria-hidden="true" />
              Baixar
            </a>
          </div>
        </div>
      </div>
      {visualizarTemplate && (
        <VisualizadorArquivo
          arquivoUrl={`${import.meta.env.BASE_URL}documentos/template-de-relatorio.pdf`}
          downloadUrl={`${import.meta.env.BASE_URL}documentos/template-de-relatorio.docx`}
          nomeArquivo="Template de relatório.docx"
          mimeType="application/pdf"
          onClose={() => setVisualizarTemplate(false)}
        />
      )}
    </section>
  );
};
