'use client';

import React, { useState, useEffect } from 'react';
import { useTheme } from 'next-themes';
import Cookies from 'js-cookie';
import { 
  Palette, Share2, Database, BarChart3, 
  User, ShieldCheck, Moon, Sun, Camera, 
  Save, Settings2, Fingerprint, Plus, Loader2 
} from 'lucide-react';

export default function ConfigPage() {
  const [activeTab, setActiveTab] = useState('geral');
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [nomeUsuario, setNomeUsuario] = useState('');
  const [emailUsuario, setEmailUsuario] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  useEffect(() => {
    setMounted(true);
    const userRaw = localStorage.getItem('usuario') || Cookies.get('usuario');
    
    if (userRaw) {
      try {
        const cleanJson = userRaw.startsWith('j:') ? userRaw.substring(2) : userRaw;
        const user = JSON.parse(cleanJson);
        
        setNomeUsuario(user.nome || user.name || "");
        setEmailUsuario(user.email || "");
        
        if (user.fotoUrl) {
          setPreviewUrl(`http://localhost:3001${user.fotoUrl}`);
        }

        // ✅ Lógica de Admin preservada para as abas Master
        const cargoNome = user.grupo?.nome || user.role || user.cargo || "";
        const cargoStr = cargoNome.toString().toUpperCase();
        const temPermissaoTotal = user.grupo?.grupo_permissoes?.all === true;
        const masterRoles = ['ADMIN', 'ADMINISTRADOR', 'DRT', 'PRESIDENTE', 'ROOT'];
        
        if (masterRoles.some(role => cargoStr.includes(role)) || temPermissaoTotal) {
          setIsAdmin(true);
        }
      } catch (e) {
        console.error("Erro ao carregar perfil:", e);
      }
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    setLoading(true);
    
    // ❌ Removido: Cookies.get('@ITP:token') - JS não lê cookies HttpOnly!

    const formData = new FormData();
    formData.append('nome', nomeUsuario);
    formData.append('email', emailUsuario);
    if (selectedFile) {
      formData.append('foto', selectedFile);
    }

    try {
      const apiUrl = 'http://localhost:3001/api';
      const response = await fetch(`${apiUrl}/usuarios/perfil`, {
        method: 'PATCH',
        // ✅ O segredo: credentials include faz o browser enviar o cookie blindado
        credentials: 'include', 
        body: formData,
        // ❌ Não defina Headers de Authorization manuais aqui se usar cookies
      });

      if (response.status === 401) {
        alert("Sessão inválida. Por favor, saia e entre novamente.");
        return;
      }

      if (response.ok) {
        const dadosNovos = await response.json();
        const userOld = JSON.parse(localStorage.getItem('usuario') || '{}');
        localStorage.setItem('usuario', JSON.stringify({ ...userOld, ...dadosNovos }));
        window.dispatchEvent(new Event('storage')); 
        alert("Alterações salvas com sucesso!");
      }
    } catch (error) {
      console.error("Erro na requisição:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans antialiased transition-colors duration-500 text-left">
      <div className="max-w-[1600px] mx-auto space-y-8">
        
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-purple-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter shadow-lg shadow-purple-500/20">
                Sistema & Preferências
              </span>
              <span className="text-slate-400 dark:text-slate-500 text-[10px] font-bold uppercase tracking-widest flex items-center gap-1">
                <Settings2 size={12} /> Ajustes de Core e Identidade
              </span>
            </div>
            <h1 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
              Configurações <span className="text-purple-600">Globais</span>
            </h1>
          </div>
        </header>

        <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4 mb-8`}>
          <ConfigTab label="Geral e Aparência" id="geral" active={activeTab} set={setActiveTab} icon={Palette} />
          <ConfigTab label="Meu Perfil ITP" id="perfil" active={activeTab} set={setActiveTab} icon={User} />
          {isAdmin && (
            <ConfigTab label="Gestão de Acesso" id="acesso" active={activeTab} set={setActiveTab} icon={ShieldCheck} />
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            {activeTab === 'geral' && (
              <section className="bg-white dark:bg-slate-800/50 p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <Palette className="text-purple-600 dark:text-purple-400" />
                  <h2 className="text-sm font-black uppercase text-gray-800 dark:text-slate-100 tracking-widest">Interface do Usuário</h2>
                </div>
                <div className="flex justify-between items-center p-6 bg-slate-50 dark:bg-slate-900 rounded-[24px] border border-slate-100 dark:border-slate-700 group hover:border-purple-200 dark:hover:border-purple-500/50 transition-all">
                  <div className="flex flex-col text-left">
                    <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-100">Modo de Exibição</span>
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tight italic">
                      {theme === 'dark' ? 'Otimizado para Ambientes Escuros' : 'Otimizado para Alta Luminosidade'}
                    </span>
                  </div>
                  <button 
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    className={`w-16 h-8 rounded-full transition-all flex items-center px-1.5 shadow-inner ${theme === 'dark' ? 'bg-purple-600' : 'bg-slate-300'}`}
                  >
                    <div className={`w-5 h-5 rounded-full bg-white shadow-lg transform transition-transform flex items-center justify-center ${theme === 'dark' ? 'translate-x-8' : 'translate-x-0'}`}>
                      {theme === 'dark' ? <Moon size={12} className="text-purple-600" /> : <Sun size={12} className="text-yellow-500" />}
                    </div>
                  </button>
                </div>
              </section>
            )}

            {activeTab === 'perfil' && (
              <section className="bg-white dark:bg-slate-800/50 p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <User className="text-purple-600 dark:text-purple-400" />
                  <h2 className="text-sm font-black uppercase text-gray-800 dark:text-slate-100 tracking-widest">Meu Perfil</h2>
                </div>
                
                <div className="flex flex-col items-center gap-4 mb-8">
                  <div className="relative group cursor-pointer" onClick={() => document.getElementById('fileInput').click()}>
                    <div className="w-28 h-28 rounded-[38px] bg-slate-900 flex items-center justify-center border-4 border-slate-100 dark:border-slate-700 overflow-hidden group-hover:border-purple-500 transition-all">
                      {previewUrl ? (
                        <img src={previewUrl} className="w-full h-full object-cover" alt="Preview" />
                      ) : (
                        <User size={48} className="text-yellow-400" />
                      )}
                    </div>
                    <input type="file" id="fileInput" hidden onChange={handleFileChange} accept="image/*" />
                    <div className="absolute -bottom-2 -right-2 p-2.5 bg-yellow-400 rounded-2xl shadow-xl text-purple-950 hover:scale-110 transition-transform">
                      <Camera size={18} strokeWidth={3} />
                    </div>
                  </div>
                  <p className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest italic">Alterar Foto de Perfil</p>
                </div>

                <div className="space-y-4">
                  <InputField label="Nome de Exibição" value={nomeUsuario} onChange={(e) => setNomeUsuario(e.target.value)} />
                  <InputField label="E-mail de Acesso" value={emailUsuario} onChange={(e) => setEmailUsuario(e.target.value)} />
                  <button 
                    onClick={handleSave}
                    disabled={loading}
                    className="w-full bg-slate-900 dark:bg-yellow-400 text-yellow-400 dark:text-purple-950 py-4 rounded-2xl font-black text-[11px] uppercase flex items-center justify-center gap-3 shadow-xl active:scale-95 transition-all"
                  >
                    {loading ? <Loader2 className="animate-spin" size={18} /> : <><Save size={18} strokeWidth={3} /> Salvar Alterações</>}
                  </button>
                </div>
              </section>
            )}

            {activeTab === 'acesso' && isAdmin && (
              <section className="bg-white dark:bg-slate-800/50 p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-sm space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <ShieldCheck className="text-purple-600 dark:text-purple-400" />
                  <h2 className="text-sm font-black uppercase text-gray-800 dark:text-slate-100 tracking-widest">Nível de Segurança</h2>
                </div>
                <div className="p-8 bg-purple-50 dark:bg-slate-900 rounded-[32px] border border-purple-100 dark:border-purple-900/50 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10 dark:opacity-20"><Fingerprint size={80} /></div>
                   <p className="text-[10px] font-black text-purple-900 dark:text-purple-400 uppercase mb-2 italic">Permissão Detectada:</p>
                   <div className="text-3xl font-black text-purple-600 dark:text-purple-300 uppercase tracking-tighter italic">ACESSO MASTER ATIVO</div>
                </div>
              </section>
            )}
          </div>

          <section className="bg-white dark:bg-slate-800/50 p-8 rounded-[40px] border border-slate-100 dark:border-slate-700 shadow-sm h-fit">
            <div className="flex items-center gap-3 mb-8 text-blue-600 dark:text-blue-400">
              <Share2 />
              <h2 className="text-sm font-black uppercase text-gray-800 dark:text-slate-100 tracking-widest">Conexões Externas</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <IntegrationBadge icon={<BarChart3 size={16}/>} label="Power BI" status="Conectado" color="text-yellow-600" bg="bg-yellow-50 dark:bg-yellow-500/5" />
              <IntegrationBadge icon={<Database size={16}/>} label="Neon Postgres" status="Online" color="text-blue-600" bg="bg-blue-50 dark:bg-blue-500/5" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ConfigTab({ label, id, active, set, icon: Icon }) {
  const isActive = active === id;
  return (
    <button onClick={() => set(id)} className={`p-6 rounded-[35px] border transition-all duration-300 flex items-center gap-4 group ${isActive ? 'bg-purple-950 border-purple-950 text-white shadow-2xl scale-105 dark:bg-purple-600' : 'bg-white dark:bg-slate-800 border-slate-100 text-slate-500 shadow-sm'}`}>
      <div className={`p-3.5 rounded-2xl flex items-center justify-center transition-all ${isActive ? 'bg-purple-600 shadow-inner' : 'bg-slate-50 dark:bg-slate-900'}`}>
        <Icon size={22} className={isActive ? 'text-white' : ''} />
      </div>
      <div className="text-left font-black uppercase text-sm tracking-tighter">{label}</div>
    </button>
  );
}

function IntegrationBadge({ icon, label, status, color, bg }) {
  return (
    <div className={`p-5 ${bg} rounded-[30px] border border-transparent dark:border-slate-700/50 hover:border-slate-200 transition-all`}>
      <div className={`flex items-center gap-2.5 mb-2 ${color}`}>
        {icon} <span className="text-[10px] font-black uppercase tracking-tighter dark:text-slate-100">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${color.replace('text', 'bg')} animate-pulse shadow-sm`} />
        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{status}</span>
      </div>
    </div>
  );
}

function InputField({ label, value, onChange }) {
  return (
    <div className="flex flex-col gap-2.5 text-left">
      <label className="text-[10px] font-black text-slate-500 dark:text-slate-300 uppercase tracking-[0.15em] px-1.5">{label}</label>
      <input type="text" value={value} onChange={onChange} className="w-full px-6 py-4.5 bg-slate-50 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-[22px] text-xs font-bold outline-none focus:ring-4 focus:ring-purple-500/20 focus:border-purple-500 transition-all dark:text-white shadow-inner" />
    </div>
  );
}