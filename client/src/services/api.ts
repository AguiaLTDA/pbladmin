const API_BASE_URL = 'http://localhost:4000/api';

export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem('pbl_auth_token');

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

export function getDownloadUrl(fileId: number): string {
  return `${API_BASE_URL}/files/download/${fileId}`;
}
