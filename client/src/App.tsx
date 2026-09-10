import React, { useState, useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { LoginView } from './views/auth/Login';
import { PerfilView } from './views/auth/Perfil';
import { CadastroEstudanteView } from './views/auth/CadastroEstudante';
import { RecuperarSenhaView } from './views/auth/RecuperarSenha';
import { RedefinirSenhaView } from './views/auth/RedefinirSenha';
import { VerificarEmailView } from './views/auth/VerificarEmail';

// Admin Views
import { DashboardAdminView } from './views/admin/DashboardAdmin';
import { CaixaEntradaPBLView } from './views/admin/CaixaEntradaPBL';
import { RevisaoPBLView } from './views/admin/RevisaoPBL';
import { SegmentacaoPBLView } from './views/admin/SegmentacaoPBL';
import { AgendamentoPublicacaoView } from './views/admin/AgendamentoPublicacao';
import { UsuariosAdminView } from './views/admin/UsuariosAdmin';
import { EstudantesAdminView } from './views/admin/EstudantesAdmin';
import { AcademicAdminView } from './views/admin/AcademicAdmin';
import { GerenciadorArquivosView } from './views/admin/GerenciadorArquivos';
import { RelatoriosAdminView } from './views/admin/RelatoriosAdmin';
import { AuditoriaAdminView } from './views/admin/AuditoriaAdmin';
import { ConfiguracoesAdminView } from './views/admin/ConfiguracoesAdmin';
import { EditorPBLAdminView } from './views/admin/EditorPBLAdmin';

// Professor Views
import { DashboardProfessorView } from './views/professor/DashboardProfessor';
import { EntregasProfessorView } from './views/professor/EntregasProfessor';
import { MinhasTurmasProfessorView } from './views/professor/MinhasTurmasProfessor';
import { ArquivoOrientadorProfessorView } from './views/professor/ArquivoOrientadorProfessor';
import { MateriaisRecebidosProfessorView } from './views/professor/MateriaisRecebidosProfessor';

// Aluno Views
import { DashboardAlunoView } from './views/aluno/DashboardAluno';
import { MinhasAtividadesAlunoView } from './views/aluno/MinhasAtividadesAluno';
import { CalendarioPrazosAlunoView } from './views/aluno/CalendarioPrazosAluno';
import { DetalhesPBLAlunoView } from './views/aluno/DetalhesPBLAluno';
import { MeuGrupoAlunoView } from './views/aluno/MeuGrupoAluno';

/**
 * Separa o caminho da query string do hash. Os links enviados por e-mail
 * chegam como `#/verificar-email?token=...`, e o roteamento compara o caminho
 * com `===` — sem tirar a query, nenhuma rota casaria.
 */
function lerHash(): { rota: string; params: URLSearchParams } {
  const hash = window.location.hash.replace(/^#/, '');
  const corte = hash.indexOf('?');
  const rota = corte >= 0 ? hash.slice(0, corte) : hash;
  const params = new URLSearchParams(corte >= 0 ? hash.slice(corte + 1) : '');
  return { rota: rota || '/login', params };
}

export const App: React.FC = () => {
  const { user, isAuthenticated, loading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>(() => lerHash().rota);
  const [routeParams, setRouteParams] = useState<URLSearchParams>(() => lerHash().params);

  useEffect(() => {
    const handleHashChange = () => {
      const { rota, params } = lerHash();
      setCurrentRoute(rota);
      setRouteParams(params);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
    const corte = path.indexOf('?');
    setCurrentRoute(corte >= 0 ? path.slice(0, corte) : path);
    setRouteParams(new URLSearchParams(corte >= 0 ? path.slice(corte + 1) : ''));
  };

  // Redirect after login if on /login
  useEffect(() => {
    if (isAuthenticated && user && (currentRoute === '/login' || currentRoute === '')) {
      if (user.perfilNome === 'ADMIN') navigate('/admin/dashboard');
      else if (user.perfilNome === 'PROFESSOR') navigate('/professor/dashboard');
      else navigate('/aluno/dashboard');
    }
  }, [isAuthenticated, user]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f172a', color: 'white' }}>
        <div>Carregando Plataforma PBL...</div>
      </div>
    );
  }

  // Rotas públicas (não exigem autenticação). Precisam vir ANTES do bloco de
  // login: os links de e-mail são abertos por quem ainda não entrou no portal —
  // e, no caso da validação, por quem está justamente impedido de entrar.
  if (currentRoute === '/cadastro') {
    return <CadastroEstudanteView navigate={navigate} />;
  }

  if (currentRoute === '/recuperar-senha') {
    return <RecuperarSenhaView navigate={navigate} />;
  }

  if (currentRoute === '/redefinir-senha') {
    return <RedefinirSenhaView navigate={navigate} token={routeParams.get('token') || ''} />;
  }

  if (currentRoute === '/verificar-email') {
    return <VerificarEmailView navigate={navigate} token={routeParams.get('token') || ''} />;
  }

  if (!isAuthenticated || currentRoute === '/login') {
    return <LoginView navigate={navigate} />;
  }

  const role = user?.perfilNome;

  const renderContent = () => {
    // Route matching
    if (currentRoute === '/perfil') return <PerfilView />;

    // ADMIN ROUTES
    if (role === 'ADMIN') {
      if (currentRoute === '/admin/dashboard') return <DashboardAdminView navigate={navigate} />;
      if (currentRoute === '/admin/caixa-entrada') return <CaixaEntradaPBLView navigate={navigate} />;
      if (currentRoute === '/admin/pbl/criar') return <EditorPBLAdminView navigate={navigate} />;
      if (currentRoute.startsWith('/admin/pbl/editar/')) {
        const id = currentRoute.split('/admin/pbl/editar/')[1];
        return <EditorPBLAdminView activityId={id} navigate={navigate} />;
      }
      if (currentRoute.startsWith('/admin/revisao/')) {
        const id = currentRoute.split('/admin/revisao/')[1];
        return <RevisaoPBLView activityId={id} navigate={navigate} />;
      }
      if (currentRoute.startsWith('/admin/segmentacao/')) {
        const id = currentRoute.split('/admin/segmentacao/')[1];
        return <SegmentacaoPBLView activityId={id} navigate={navigate} />;
      }
      if (currentRoute.startsWith('/admin/agendamento/')) {
        const id = currentRoute.split('/admin/agendamento/')[1];
        return <AgendamentoPublicacaoView activityId={id} navigate={navigate} />;
      }
      if (currentRoute === '/admin/usuarios') return <UsuariosAdminView />;
      if (currentRoute === '/admin/estudantes') return <EstudantesAdminView />;
      if (currentRoute === '/admin/academic') return <AcademicAdminView />;
      // Mesma tela do professor: para o ADMIN ela habilita exclusão/restauração de entregas.
      if (currentRoute === '/admin/entregas') return <EntregasProfessorView />;
      if (currentRoute === '/admin/arquivos') return <GerenciadorArquivosView />;
      if (currentRoute === '/admin/relatorios') return <RelatoriosAdminView />;
      if (currentRoute === '/admin/auditoria') return <AuditoriaAdminView />;
      if (currentRoute === '/admin/configuracoes') return <ConfiguracoesAdminView />;
    }

    // PROFESSOR ROUTES
    // Criação/edição de PBL é exclusiva do Admin — o professor só revisa/avalia
    // entregas e cuida do próprio arquivo orientador.
    if (role === 'PROFESSOR') {
      if (currentRoute === '/professor/dashboard') return <DashboardProfessorView navigate={navigate} />;
      if (currentRoute === '/professor/entregas') return <EntregasProfessorView />;
      if (currentRoute === '/professor/turmas') return <MinhasTurmasProfessorView />;
      if (currentRoute === '/professor/arquivo-orientador') return <ArquivoOrientadorProfessorView />;
      if (currentRoute === '/professor/materiais') return <MateriaisRecebidosProfessorView />;
    }

    // ALUNO ROUTES
    if (role === 'ALUNO') {
      if (currentRoute === '/aluno/dashboard') return <DashboardAlunoView navigate={navigate} />;
      if (currentRoute === '/aluno/atividades') return <MinhasAtividadesAlunoView navigate={navigate} />;
      if (currentRoute === '/aluno/grupo') return <MeuGrupoAlunoView />;
      if (currentRoute === '/aluno/calendario') return <CalendarioPrazosAlunoView navigate={navigate} />;
      if (currentRoute.startsWith('/aluno/atividade/')) {
        const id = currentRoute.split('/aluno/atividade/')[1];
        return <DetalhesPBLAlunoView activityId={id} navigate={navigate} />;
      }
    }

    // Fallback 404 / Forbidden
    return (
      <div className="card text-center py-8">
        <h3 className="font-bold text-lg mb-2">Acesso Negado ou Rota Não Encontrada (404)</h3>
        <p className="text-muted text-sm mb-4">Você não possui permissão para acessar este recurso ou a página não existe.</p>
        <button
          onClick={() => {
            if (role === 'ADMIN') navigate('/admin/dashboard');
            else if (role === 'PROFESSOR') navigate('/professor/dashboard');
            else navigate('/aluno/dashboard');
          }}
          className="btn btn-primary"
          style={{ width: 'fit-content', margin: '0 auto' }}
        >
          Ir para o Meu Dashboard
        </button>
      </div>
    );
  };

  const getPageTitle = () => {
    if (currentRoute.startsWith('/admin')) return 'Portal Administrativo';
    if (currentRoute.startsWith('/professor')) return 'Portal do Professor';
    if (currentRoute.startsWith('/aluno')) return 'Portal do Aluno';
    return 'Plataforma PBL';
  };

  return (
    <div className="app-container">
      <Sidebar currentRoute={currentRoute} navigate={navigate} />
      <div className="main-wrapper">
        <Navbar title={getPageTitle()} navigate={navigate} />
        <main className="main-content">{renderContent()}</main>
      </div>
    </div>
  );
};
