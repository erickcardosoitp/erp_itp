import axios from 'axios';

const api = axios.create({
  // Ajustado para 127.0.0.1 para evitar problemas de resolução de DNS do Windows
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('@ITP:token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

export default api;