// src/app/relatorios/page.jsx
import { FileText, Download, Filter, Printer } from 'lucide-react';

export default function RelatoriosPage() {
  const categorias = [
    { nome: 'Alunos', itens: ['Evasão Escolar', 'Frequência por Turma', 'Lista de Contatos'] },
    { nome: 'Financeiro', itens: ['DRE Simplificado', 'Inadimplência', 'Doações Mensais'] },
    { nome: 'Estoque', itens: ['Consumo de Insumos', 'Inventário Atual', 'Alerta de Reposição'] },
    { nome: 'RH', itens: ['Quadro de Professores', 'Carga Horária'] },
  ];

  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-black uppercase text-purple-950">Central de Relatórios</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {categorias.map((cat) => (
          <div key={cat.nome} className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
            <h3 className="text-xs font-black uppercase text-purple-600 mb-4 tracking-widest">{cat.nome}</h3>
            <div className="space-y-2">
              {cat.itens.map((relatorio) => (
                <div key={relatorio} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-purple-50 transition-all cursor-pointer">
                  <span className="text-xs font-bold text-gray-700 uppercase">{relatorio}</span>
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button className="p-2 bg-white rounded-lg border border-gray-200 text-purple-600 hover:shadow-sm"><Printer size={14}/></button>
                    <button className="p-2 bg-purple-600 rounded-lg text-white hover:bg-purple-700 shadow-md"><Download size={14}/></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}