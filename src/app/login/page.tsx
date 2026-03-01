'use client'; // ESSENCIAL: Diz ao Next que este componente tem interação (botões, inputs)

import React, { useState } from 'react'; // Adicionado React para tipagem
import axios from 'axios';
import { useRouter } from 'next/navigation'; // Hook de navegação do Next.js

export default function LoginPage() {
  const [email, setEmail] = useState('admin@itp.com');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter(); // Instância para redirecionar

  // Corrigida a tipagem do evento (e)
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    try {
      // 1. Chamada para o seu NestJS na Vercel
      const response = await axios.post('https://erp-itp.vercel.app/auth/login', {
        email,
        pass: password // 'pass' para bater com seu AuthService.ts
      });

      const { access_token, user } = response.data;

      if (access_token) {
        localStorage.setItem('@ITP:token', access_token);
        localStorage.setItem('@ITP:user', JSON.stringify(user));
        
        // 2. Redirecionamento usando o Router do Next.js
        router.push('/matriculas');
      }
    } catch (error: any) {
      alert('Erro ao acessar: ' + (error.response?.data?.message || 'Verifique sua conexão'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#6B21A8] flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-black text-white tracking-tighter italic">
          ITP <span className="text-[#FACC15]">ERP</span>
        </h1>
      </div>

      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border-b-8 border-[#FACC15]">
        <div className="p-10">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">Acesso Restrito</h2>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1 text-gray-500">
                E-mail Administrativo
              </label>
              <input 
                type="email" 
                value={email}
                // Adicionada tipagem do evento de mudança
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-[#6B21A8] outline-none transition-all text-black"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-400 uppercase mb-2 ml-1 text-gray-500">
                Senha
              </label>
              <input 
                type="password" 
                value={password}
                // Adicionada tipagem do evento de mudança
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                className="w-full px-5 py-4 bg-gray-50 border-2 border-transparent rounded-2xl focus:border-[#6B21A8] outline-none transition-all text-black"
                required
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-[#6B21A8] hover:bg-[#581c87] text-white font-black py-4 rounded-2xl shadow-lg transition-all transform active:scale-95 disabled:opacity-50"
            >
              {loading ? 'AUTENTICANDO...' : 'ENTRAR NO SISTEMA'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}