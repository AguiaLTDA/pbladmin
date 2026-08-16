import { isSupabaseConfigured } from './supabase';
import { supabaseService } from './supabaseService';

const API_BASE_URL = 'http://localhost:4000/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('pbl_auth_token');

  // Se o Supabase estiver configurado e estivermos no cliente web (ou produção)
  if (isSupabaseConfigured) {
    try {
      const res = await handleSupabaseRequest<T>(endpoint, options);
      if (res !== undefined) return res;
    } catch (err: any) {
      console.warn(`Supabase handler error on ${endpoint}:`, err?.message || err);
      // Fallback para API HTTP se necessário
    }
  }

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>)
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401) {
    localStorage.removeItem('pbl_auth_token');
    localStorage.removeItem('pbl_user_data');
    if (!window.location.pathname.includes('/login')) {
      window.location.href = '/login';
    }
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Erro ao processar requisição.');
    }
    return data as T;
  }

  if (!response.ok) {
    throw new Error(`Erro na requisição: ${response.statusText}`);
  }

  return (await response.text()) as unknown as T;
}

// Roteador inteligente que intercepta chamadas de API e executa via Supabase SDK
async function handleSupabaseRequest<T>(endpoint: string, options: RequestInit): Promise<T | undefined> {
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body ? (typeof options.body === 'string' ? JSON.parse(options.body) : options.body) : {};

  // Auth Login
  if (endpoint === '/auth/login' && method === 'POST') {
    return (await supabaseService.login(body.email, body.senha)) as unknown as T;
  }

  // Auth Profile
  if (endpoint === '/auth/profile' && method === 'GET') {
    const saved = localStorage.getItem('pbl_user_data');
    const parsed = saved ? JSON.parse(saved) : null;
    if (parsed?.id) {
      return (await supabaseService.getUserProfile(parsed.id)) as unknown as T;
    }
  }

  // Dashboard Stats
  if (endpoint.startsWith('/dashboard') && method === 'GET') {
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : {};
    return (await supabaseService.getDashboardStats(user.id, user.perfilNome)) as unknown as T;
  }

  // List Activities
  if (endpoint.startsWith('/pbl/activities') && method === 'GET') {
    const parts = endpoint.split('/').filter(Boolean); // ['pbl', 'activities', '1']
    if (parts.length === 3) {
      const id = parseInt(parts[2], 10);
      return (await supabaseService.getActivityById(id)) as unknown as T;
    }
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : {};
    return (await supabaseService.getActivities(user.id, user.perfilNome)) as unknown as T;
  }

  // Create Activity
  if (endpoint === '/pbl/activities' && method === 'POST') {
    return (await supabaseService.createActivity(body)) as unknown as T;
  }

  // Notifications
  if (endpoint === '/notifications' && method === 'GET') {
    const saved = localStorage.getItem('pbl_user_data');
    const user = saved ? JSON.parse(saved) : {};
    return (await supabaseService.getNotifications(user.id)) as unknown as T;
  }

  // Audit Logs
  if (endpoint.startsWith('/audit') && method === 'GET') {
    return (await supabaseService.getAuditLogs()) as unknown as T;
  }

  return undefined;
}

export function getDownloadUrl(fileId: number): string {
  if (isSupabaseConfigured) {
    return `https://placeholder.supabase.co/storage/v1/object/public/pbl-files/${fileId}`;
  }
  return `${API_BASE_URL}/files/download/${fileId}`;
}
