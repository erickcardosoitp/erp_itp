import { Settings, Palette, Share2, Database, Map as MapIcon, BarChart3 } from 'lucide-react';

export default function ConfigPage() {
  return (
    <div className="p-8 space-y-8">
      <h1 className="text-3xl font-black uppercase text-purple-950">Configurações</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Aparência */}
        <section className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="text-purple-600" />
            <h2 className="text-sm font-black uppercase text-gray-800">Aparência do ERP</h2>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-4 bg-gray-50 rounded-2xl">
              <span className="text-xs font-bold uppercase">Tema Dark/Light</span>
              <div className="w-12 h-6 bg-purple-950 rounded-full"></div>
            </div>
          </div>
        </section>

        {/* Integrações */}
        <section className="bg-white p-8 rounded-[40px] border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Share2 className="text-blue-600" />
            <h2 className="text-sm font-black uppercase text-gray-800">Integrações Ativas</h2>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <IntegrationBadge icon={<BarChart3 size={14}/>} label="Power BI" status="Conectado" color="text-yellow-600" />
            <IntegrationBadge icon={<MapIcon size={14}/>} label="Google Maps" status="Ativo" color="text-green-600" />
            <IntegrationBadge icon={<Database size={14}/>} label="PostgreSQL" status="Online" color="text-blue-600" />
          </div>
        </section>
      </div>
    </div>
  );
}

function IntegrationBadge({ icon, label, status, color }) {
  return (
    <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100">
      <div className={`flex items-center gap-2 mb-1 ${color}`}>
        {icon}
        <span className="text-[10px] font-black uppercase">{label}</span>
      </div>
      <span className="text-[9px] font-bold text-gray-400 uppercase">{status}</span>
    </div>
  );
}