import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.itp.institutotiapretinha.org/api',
  withCredentials: true, // httpOnly cookie enviado automaticamente pelo browser
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn("🚨 [API] 401: Token inválido ou sessão expirada.");
    }
    return Promise.reject(error);
  }
);

export default api;