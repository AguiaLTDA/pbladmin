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
  PlusCircle,
  FileCheck2,
  GraduationCap,
  Calendar,
  LogOut,
  Layers,
  Award
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SidebarProps {
  currentRoute: string;
  navigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, navigate }) => {
  const { user, logout } = useAuth();
  if (!user) return null;

  const role = user.perfilNome;

  const getAdminItems = () => [
    { path: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/admin/caixa-entrada', label: 'Caixa de Entrada PBL', icon: Inbox },
    { path: '/admin/usuarios', label: 'Gestão de Usuários', icon: Users },
    { path: '/admin/academic', label: 'Cursos, Turmas & Grupos', icon: BookOpen },
    { path: '/admin/arquivos', label: 'Gerenciador de Arquivos', icon: FolderOpen },
    { path: '/admin/relatorios', label: 'Relatórios & Exportação', icon: BarChart3 },
    { path: '/admin/auditoria', label: 'Trilha de Auditoria', icon: ShieldCheck },
    { path: '/admin/configuracoes', label: 'Configurações PBL', icon: Settings }
  ];

  const getProfessorItems = () => [
    { path: '/professor/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/professor/atividades', label: 'Minhas Atividades PBL', icon: Layers },
    { path: '/professor/criar-pbl', label: 'Criar Atividade PBL', icon: PlusCircle },
    { path: '/professor/entregas', label: 'Acompanhamento & Entregas', icon: Award }
  ];

  const getAlunoItems = () => [
    { path: '/aluno/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/aluno/atividades', label: 'Minhas Atividades', icon: GraduationCap },
    { path: '/aluno/calendario', label: 'Calendário de Prazos', icon: Calendar }
  ];

  let navItems = getAlunoItems();
  if (role === 'ADMIN') navItems = getAdminItems();
  if (role === 'PROFESSOR') navItems = getProfessorItems();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-icon">★</div>
        <div>
          <div className="brand-title">UNIVC</div>
          <div className="brand-subtitle">Vale do Cricaré • PBL</div>
        </div>
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
                navigate(item.path);
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
          <div className="avatar">{user.nome.charAt(0).toUpperCase()}</div>
          <div className="user-info">
            <span className="user-name" title={user.nome}>{user.nome}</span>
            <span className={`user-role-badge role-${user.perfilNome.toLowerCase()}`}>
              {user.perfilNome}
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
