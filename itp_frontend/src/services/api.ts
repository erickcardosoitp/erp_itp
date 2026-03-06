import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  // ✅ Aponta para o backend NestJS (Porta 3001) em dev, ou /api em prod (Vercel)
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api',
  withCredentials: true, // Essencial para cross-origin cookies
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  // ✅ Nome sincronizado com o Backend: 'itp_token'
  const token = Cookies.get('itp_token');
  
  if (token && config.headers) {
    // ✅ Envia o token puro, garantindo que não existam aspas corrompendo o JWT
    config.headers.Authorization = `Bearer ${token.replace(/"/g, '')}`;
  }
  return config;
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