'use client';

import React, { useState, useEffect } from 'react';
import { 
  Package, AlertTriangle, ArrowDownCircle, Search, 
  Plus, History, BarChart3, Filter, 
  ArrowUpCircle, ChevronRight, Boxes, ShoppingCart
} from 'lucide-react';

export default function EstoqueProPage() {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  if (!isMounted) return null;

  return (
    <div className="min-h-screen bg-[#FDFDFF] p-6 lg:p-10 font-sans">
      <div className="max-w-[1500px] mx-auto space-y-8">
        
        {/* HEADER */}
        <header className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-3 rounded-2xl shadow-xl">
              <Boxes className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter">
                Almoxarifado<span className="text-purple-600">.ITP</span>
              </h1>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <BarChart3 size={14} className="text-purple-600" /> Giro de Estoque & Suprimentos
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <button className="bg-white border-2 border-slate-100 text-slate-600 px-6 py-4 rounded-2xl font-black text-[10px] uppercase hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2">
              <ArrowDownCircle size={18} /> Registrar Baixa
            </button>
            <button className="bg-purple-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl shadow-purple-600/20 border-b-4 border-purple-800 active:translate-y-1 active:border-b-0 transition-all flex items-center gap-3">
              <Plus size={18} strokeWidth={3} /> Entrada de Material
            </button>
          </div>
        </header>

        {/* ALERTAS */}
        <div className="bg-amber-50 border-l-8 border-amber-400 p-6 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-amber-100 p-3 rounded-full animate-pulse">
              <AlertTriangle className="text-amber-600" size={24} />
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-900 tracking-tight">Estoque Crítico Detectado</p>
              <p className="text-[10px] font-bold text-amber-700 uppercase">Itens de Alimentação e Pedagógicos estão abaixo do mínimo.</p>
            </div>
          </div>
        </div>

        {/* GRID DE CATEGORIAS (CORRIGIDO) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <InventorySection 
            title="Insumos Pedagógicos" 
            color="purple" 
            icon={Plus}
            items={[
              { nome: 'Papel A4 Report', qtd: 45, unit: 'Resmas', status: 'ok' },
              { nome: 'Caneta Azul Bic', qtd: 8, unit: 'Caixas', status: 'alerta' },
              { nome: 'Tinta Guache 500ml', qtd: 12, unit: 'Unid.', status: 'ok' },
            ]} 
          />
          <InventorySection 
            title="Copa & Cozinha" 
            color="orange" 
            icon={ShoppingCart}
            items={[
              { nome: 'Arroz Agulhinha 5kg', qtd: 4, unit: 'Sacos', status: 'critico' },
              { nome: 'Feijão Carioca 1kg', qtd: 15, unit: 'Pacotes', status: 'ok' },
              { nome: 'Leite Integral 1L', qtd: 24, unit: 'Caixas', status: 'ok' },
            ]} 
          />
          <InventorySection 
            title="Limpeza & Higiene" 
            color="blue" 
            icon={History}
            items={[
              { nome: 'Detergente Neutro', qtd: 20, unit: 'Frascos', status: 'ok' },
              { nome: 'Álcool 70% 1L', qtd: 5, unit: 'Unid.', status: 'alerta' },
              { nome: 'Sabão em Pó 2kg', qtd: 10, unit: 'Caixas', status: 'ok' },
            ]} 
          />
        </div>
      </div>
    </div>
  );
}

function InventorySection({ title, items, color, icon: Icon }) {
  const theme = {
    purple: { bg: 'bg-purple-50', text: 'text-purple-600', border: 'border-purple-100' },
    orange: { bg: 'bg-orange-50', text: 'text-orange-600', border: 'border-orange-100' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', border: 'border-blue-100' },
  };

  return (
    <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm hover:shadow-xl transition-all">
      <div className="flex justify-between items-center mb-8">
        <h3 className={`text-xs font-black uppercase tracking-widest ${theme[color].text}`}>{title}</h3>
        <div className={`p-2 rounded-xl ${theme[color].bg} ${theme[color].text}`}>
          <Icon size={18} />
        </div>
      </div>
      <div className="space-y-4">
        {items.map((item, idx) => (
          <div key={idx} className="flex flex-col gap-2 p-4 bg-slate-50/50 rounded-2xl border border-transparent hover:border-slate-100 transition-all">
            <div className="flex justify-between items-center">
              <span className="text-[11px] font-black text-slate-800 uppercase italic">{item.nome}</span>
              <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${
                item.status === 'critico' ? 'text-rose-600 bg-rose-50 border-rose-100' : 
                item.status === 'alerta' ? 'text-amber-600 bg-amber-50 border-amber-100' : 
                'text-slate-400 bg-slate-50 border-slate-100'
              }`}>
                {item.status}
              </span>
            </div>
            <p className="text-xl font-black text-slate-900 italic">
              {item.qtd} <span className="text-[10px] text-slate-400 not-italic uppercase font-bold">{item.unit}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}