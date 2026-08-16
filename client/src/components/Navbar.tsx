import React, { useState, useEffect } from 'react';
import { Bell, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiRequest } from '../services/api';
import { NotificationItem } from '../types';

interface NavbarProps {
  title: string;
  navigate: (path: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ title, navigate }) => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (user) {
      apiRequest<NotificationItem[]>('/notifications')
        .then((res) => setNotifications(res))
        .catch(() => {});
    }
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.lida).length;

  const markAllRead = async () => {
    try {
      await apiRequest('/notifications/all/read', { method: 'PUT' });
      setNotifications((prev) => prev.map((n) => ({ ...n, lida: 1 })));
    } catch (err) {}
  };

  return (
    <header className="top-navbar">
      <h1 className="top-navbar-title">{title}</h1>

      <div className="top-navbar-actions">
        {/* Central de Notificações */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="btn btn-secondary btn-sm"
            style={{ position: 'relative', borderRadius: '50%', width: '40px', height: '40px', padding: 0 }}
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: '#ef4444',
                  color: 'white',
                  fontSize: '0.65rem',
                  fontWeight: 700,
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {showDropdown && (
            <div
              style={{
                position: 'absolute',
                right: 0,
                top: '50px',
                width: '320px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-color)',
                borderRadius: '12px',
                boxShadow: 'var(--shadow-xl)',
                zIndex: 100,
                padding: '1rem'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-sm">Notificações</span>
                {unreadCount > 0 && (
                  <button onClick={markAllRead} className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem' }}>
                    Marcar todas lidas
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {notifications.length === 0 ? (
                  <div className="text-muted text-sm text-center py-4">Nenhuma notificação recente.</div>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        padding: '0.6rem',
                        borderRadius: '8px',
                        background: n.lida ? 'transparent' : 'var(--primary-light)',
                        border: '1px solid var(--border-color)',
                        fontSize: '0.8rem'
                      }}
                    >
                      <div className="font-bold">{n.titulo}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>{n.mensagem}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Perfil */}
        <button
          onClick={() => navigate('/perfil')}
          className="btn btn-secondary btn-sm"
          style={{ gap: '0.5rem' }}
        >
          <UserIcon size={16} />
          <span>{user?.nome.split(' ')[0]}</span>
        </button>
      </div>
    </header>
  );
};
