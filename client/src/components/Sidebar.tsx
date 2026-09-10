import React from 'react';
import {
  LayoutDashboard,
  Users,
  BookOpen,
  Inbox,
  FolderOpen,
  Send,
  BarChart3,
  ShieldCheck,
  Settings,
  FileCheck2,
  GraduationCap,
  Calendar,
  CalendarDays,
  LogOut,
  Award,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { BrandLogo } from './BrandLogo';
import { MedalhaContexto } from './MedalhaContexto';

interface SidebarProps {
  currentRoute: string;
  navigate: (path: string) => void;
  /** No mobile a barra vive fora da tela e só entra quando isto é true. */
  aberto?: boolean;
  /** Fecha a gaveta — chamado ao navegar e ao tocar fora dela. */
  onFechar?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, navigate, aberto = false, onFechar }) => {
  const { user, logout } = useAuth();
  if (!user) return null;

  // Sem error boundary na árvore, qualquer campo ausente aqui derruba a
  // aplicação inteira em tela branca. Daí os valores de segurança.
  // No mobile, tocar num item precisa levar para a rota E fechar a gaveta —
  // senão o conteúdo abre atrás de um painel que continua cobrindo a tela.
  const irPara = (path: string) => {
    navigate(path);
    onFechar?.();
  };

  const role = user.perfilNome;
  const nomeExibicao = user.nome || 'Usuário';
  const perfilExibicao = role || 'INDEFINIDO';

  const getAdminItems = () => [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/caixa-entrada', label: 'Caixa de Entrada PBL', icon: Inbox },
    { path: '/admin/usuarios', label: 'Gestão de Usuários', icon: Users },
    { path: '/admin/estudantes', label: 'Cadastro de Estudantes', icon: GraduationCap },
    { path: '/admin/academic', label: 'Cursos, Turmas & Grupos', icon: BookOpen },
    { path: '/admin/entregas', label: 'Entregas & Relatórios', icon: Award },
    { path: '/admin/arquivos', label: 'Gerenciador de Arquivos', icon: FolderOpen },
    { path: '/admin/relatorios', label: 'Relatórios & Exportação', icon: BarChart3 },
    { path: '/admin/auditoria', label: 'Trilha de Auditoria', icon: ShieldCheck },
    { path: '/admin/configuracoes', label: 'Configurações PBL', icon: Settings }
  ];

  const getProfessorItems = () => [
    { path: '/professor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/professor/turmas', label: 'Minhas Turmas & Horário', icon: CalendarDays },
    { path: '/professor/entregas', label: 'Acompanhamento & Entregas', icon: Award },
    { path: '/professor/arquivo-orientador', label: 'Arquivo Orientador', icon: BookOpen },
    { path: '/professor/materiais', label: 'Materiais Recebidos', icon: FolderOpen }
  ];

  const getAlunoItems = () => [
    { path: '/aluno/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/aluno/atividades', label: 'Minhas Atividades', icon: GraduationCap },
    { path: '/aluno/grupo', label: 'Meus Grupos PBL', icon: Users },
    { path: '/aluno/calendario', label: 'Calendário de Prazos', icon: Calendar },
    { path: '/aluno/contexto', label: 'Meu Contexto Profissional', icon: Briefcase }
  ];

  let navItems = getAlunoItems();
  if (role === 'ADMIN') navItems = getAdminItems();
  if (role === 'PROFESSOR') navItems = getProfessorItems();

  return (
    <aside className={`sidebar${aberto ? ' open' : ''}`}>
      <div className="sidebar-header">
        <BrandLogo variante="escura" tamanho="md" />
        <span className="sidebar-header-modulo">Portal PBL</span>
      </div>

      <nav className="sidebar-menu">
        <div className="nav-section-title">Navegação Principal</div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.path;
          return (
            <a
              key={item.path}
              href={`#${item.path}`}
              onClick={(e) => {
                e.preventDefault();
                irPara(item.path);
              }}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile-summary">
          <div className="avatar">{nomeExibicao.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name" title={nomeExibicao}>
              {nomeExibicao}
              <MedalhaContexto completo={user.contextoCompleto} tamanho={13} />
            </span>
            <span className={`user-role-badge role-${perfilExibicao.toLowerCase()}`}>
              {perfilExibicao}
            </span>
          </div>
        </div>
        <button
          onClick={logout}
          className="btn btn-secondary btn-sm"
          title="Sair do Sistema"
          style={{ padding: '0.4rem' }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
};
