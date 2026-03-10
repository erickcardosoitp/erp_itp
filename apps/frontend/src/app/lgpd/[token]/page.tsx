'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.itp.institutotiapretinha.org/api';

const SECOES = [
  { id: 'imagem', label: 'Autorizo o uso de imagem, voz e registros audiovisuais para fins institucionais, educativos, culturais e informativos.' },
  { id: 'divulgacao', label: 'Autorizo a divulgação das imagens e conteúdos nos meios de comunicação institucionais e plataformas digitais utilizadas pelo Instituto.' },
  { id: 'cloud', label: 'Autorizo o armazenamento de dados e conteúdos em ambiente digital seguro utilizado pelo Instituto.' },
  { id: 'dados', label: 'Declaro ciência e concordância com o tratamento dos dados pessoais para as finalidades descritas.' },
  { id: 'gratuidade', label: 'Declaro ciência quanto à gratuidade da presente autorização.' },
  { id: 'prazo', label: 'Declaro ciência quanto ao prazo indeterminado da autorização.' },
  { id: 'revogacao', label: 'Declaro ciência sobre o direito de revogação desta autorização.' },
  { id: 'confirmacao', label: 'Confirmo que li e concordo integralmente com este termo.' },
];

type Estado = 'carregando' | 'pronto' | 'invalido' | 'expirado' | 'ja_assinado' | 'sucesso';

interface DadosInscricao {
  nome_completo: string;
  cpf: string;
  email: string;
}

export default function LGPDSignPage() {
  const params = useParams();
  const token = params?.token as string;

  const [estado, setEstado] = useState<Estado>('carregando');
  const [dados, setDados] = useState<DadosInscricao | null>(null);
  const [nomeDigitado, setNomeDigitado] = useState('');
  const [cpfDigitado, setCpfDigitado] = useState('');
  const [confirmacoes, setConfirmacoes] = useState<Record<string, boolean>>({});
  const [enviando, setEnviando] = useState(false);
  const [erroMsg, setErroMsg] = useState('');

  const todasMarcadas = SECOES.every(s => confirmacoes[s.id]);

  useEffect(() => {
    if (!token) return;
    fetch(`${API}/matriculas/lgpd/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          const msg: string = json?.message || '';
          if (msg.includes('expirou')) setEstado('expirado');
          else if (msg.includes('já foi assinado')) setEstado('ja_assinado');
          else setEstado('invalido');
          return;
        }
        const json = await res.json();
        setDados(json);
        setNomeDigitado(json.nome_completo || '');
        // CPF mascarado apenas para exibição
        const cpf = json.cpf?.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4') || '';
        setCpfDigitado(cpf);
        setEstado('pronto');
      })
      .catch(() => setEstado('invalido'));
  }, [token]);

  const handleAssinar = async () => {
    if (!todasMarcadas) {
      setErroMsg('Marque todos os itens de confirmação antes de assinar.');
      return;
    }
    if (!nomeDigitado.trim() || nomeDigitado.trim().split(' ').length < 2) {
      setErroMsg('Digite seu nome completo (nome e sobrenome).');
      return;
    }
    setErroMsg('');
    setEnviando(true);
    try {
      const res = await fetch(`${API}/matriculas/lgpd/${token}/assinar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_completo: nomeDigitado.trim(),
          cpf: cpfDigitado,
          confirmacoes: SECOES.map(s => s.id),
        }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        setErroMsg(json?.message || 'Erro ao processar assinatura. Tente novamente.');
        return;
      }
      setEstado('sucesso');
    } catch {
      setErroMsg('Falha de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setEnviando(false);
    }
  };

  // ── Estados de feedback ──────────────────────────────────────
  if (estado === 'carregando') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Carregando termo…</p>
        </div>
      </div>
    );
  }

  if (estado === 'sucesso') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Termo Assinado!</h2>
          <p className="text-slate-600 mb-6">
            Sua assinatura eletrônica foi registrada com sucesso.<br />
            A equipe do Instituto Tia Pretinha dará continuidade ao seu processo de matrícula.
          </p>
          <p className="text-xs text-slate-400">
            Registrado em {new Date().toLocaleString('pt-BR')}
          </p>
        </div>
      </div>
    );
  }

  if (estado === 'ja_assinado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Termo já assinado</h2>
          <p className="text-slate-600">Este termo já foi assinado anteriormente. Nenhuma ação é necessária.</p>
        </div>
      </div>
    );
  }

  if (estado === 'expirado') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Link expirado</h2>
          <p className="text-slate-600">Este link de assinatura expirou (prazo de 72 horas). Entre em contato com o Instituto Tia Pretinha para receber um novo link.</p>
        </div>
      </div>
    );
  }

  if (estado === 'invalido') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Link inválido</h2>
          <p className="text-slate-600">Este link não é válido. Verifique se você acessou o link correto ou entre em contato com o Instituto.</p>
        </div>
      </div>
    );
  }

  // ── Estado: pronto para assinar ──────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        
        {/* Header */}
        <div className="bg-[#1e3a5f] rounded-t-2xl p-8 text-white text-center">
          <h1 className="text-2xl font-bold">Instituto Tia Pretinha</h1>
          <p className="text-blue-200 text-sm mt-1">CNPJ nº 11.759.851/0001-39</p>
          <p className="text-white/80 mt-3 font-medium">Termo de Autorização de Uso de Imagem, Voz e Tratamento de Dados Pessoais</p>
        </div>

        <div className="bg-white shadow-lg rounded-b-2xl overflow-hidden">
          
          {/* Candidato */}
          <div className="bg-blue-50 border-b border-blue-100 px-8 py-4">
            <p className="text-sm text-slate-500">Candidato(a)</p>
            <p className="text-lg font-semibold text-slate-800">{dados?.nome_completo}</p>
          </div>

          <div className="px-8 py-6 space-y-6 text-slate-700 text-sm leading-relaxed">

            {/* Secao 1 */}
            <Section numero="1" titulo="Autorização de Uso de Imagem e Voz">
              <p>Autorizo o INSTITUTO TIA PRETINHA a captar, registrar, utilizar e divulgar imagens, vídeos, gravações de áudio e demais registros audiovisuais do participante obtidos durante atividades institucionais.</p>
              <p className="mt-2">Esses registros poderão ocorrer em: aulas, oficinas e treinamentos; atividades esportivas e culturais; eventos institucionais; apresentações públicas; ações sociais e comunitárias; projetos educacionais ou culturais.</p>
            </Section>

            {/* Secao 2 */}
            <Section numero="2" titulo="Divulgação em Meios de Comunicação">
              <p>Estou ciente de que os registros poderão ser utilizados em materiais institucionais e canais de comunicação do Instituto, incluindo: redes sociais, website institucional, relatórios institucionais, materiais gráficos ou digitais, apresentações institucionais, prestação de contas de projetos, editais, relatórios e publicações de parceiros ou financiadores.</p>
            </Section>

            {/* Secao 3 */}
            <Section numero="3" titulo="Armazenamento de Dados e Conteúdos em Ambiente Digital (Cloud)">
              <p>Declaro estar ciente de que dados pessoais, imagens, vídeos e documentos poderão ser armazenados em sistemas eletrônicos, bancos de dados e plataformas de armazenamento em nuvem (cloud computing) utilizados pela instituição para fins administrativos e institucionais.</p>
            </Section>

            {/* Secao 4 */}
            <Section numero="4" titulo="Tratamento de Dados Pessoais">
              <p>Estou ciente de que os dados pessoais coletados poderão ser utilizados pelo Instituto para: cadastro e identificação do participante; gestão administrativa e operacional das atividades; comunicação institucional; registro histórico das atividades; elaboração de relatórios institucionais; prestação de contas a parceiros, financiadores e órgãos públicos.</p>
              <p className="mt-2">O tratamento de dados observará os princípios e diretrizes previstos na <strong>Lei Geral de Proteção de Dados Pessoais (LGPD)</strong>.</p>
            </Section>

            {/* Secao 5 */}
            <Section numero="5" titulo="Gratuidade da Autorização">
              <p>Declaro que a presente autorização é concedida de forma gratuita, não sendo devida qualquer remuneração pela utilização de imagem, voz ou dados relacionados às atividades institucionais.</p>
            </Section>

            {/* Secao 6 */}
            <Section numero="6" titulo="Prazo da Autorização">
              <p>A autorização concedida por meio deste termo possui prazo indeterminado, podendo ser utilizada pelo Instituto enquanto os registros forem necessários para fins institucionais, históricos ou administrativos.</p>
            </Section>

            {/* Secao 7 */}
            <Section numero="7" titulo="Direito de Revogação">
              <p>O titular dos dados ou responsável legal poderá solicitar, a qualquer momento, a revogação desta autorização ou a exclusão de dados pessoais, mediante solicitação formal enviada ao Instituto.</p>
              <p className="mt-2">A revogação não afetará utilizações realizadas anteriormente ou materiais institucionais já publicados.</p>
            </Section>

          </div>

          {/* Confirmações */}
          <div className="border-t border-slate-200 px-8 py-6 bg-slate-50">
            <h3 className="font-semibold text-slate-800 mb-4">8. Declarações de Confirmação</h3>
            <div className="space-y-3">
              {SECOES.map(secao => (
                <label key={secao.id} className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={!!confirmacoes[secao.id]}
                    onChange={e => setConfirmacoes(prev => ({ ...prev, [secao.id]: e.target.checked }))}
                    className="mt-0.5 w-4 h-4 accent-[#1e3a5f] flex-shrink-0"
                  />
                  <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                    {secao.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Assinatura eletrônica */}
          <div className="border-t border-slate-200 px-8 py-6">
            <h3 className="font-semibold text-slate-800 mb-1">Assinatura Eletrônica</h3>
            <p className="text-xs text-slate-500 mb-5">
              Ao digitar seu nome abaixo e clicar em &quot;Assinar&quot;, você confirma que leu e concorda com todos os itens deste termo.
              Sua assinatura será registrada com data, hora e endereço IP, conforme a Lei nº 14.063/2020.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Nome completo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={nomeDigitado}
                  onChange={e => setNomeDigitado(e.target.value)}
                  placeholder="Digite seu nome completo"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">CPF <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  value={cpfDigitado}
                  onChange={e => setCpfDigitado(e.target.value)}
                  placeholder="000.000.000-00"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/30 focus:border-[#1e3a5f]"
                />
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Data: {new Date().toLocaleDateString('pt-BR')}
            </div>

            {erroMsg && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {erroMsg}
              </div>
            )}

            <button
              onClick={handleAssinar}
              disabled={enviando || !todasMarcadas}
              className="mt-6 w-full bg-[#1e3a5f] text-white py-3 rounded-lg font-semibold text-sm hover:bg-[#16304f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {enviando ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Registrando assinatura…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                  Assinar Eletronicamente
                </>
              )}
            </button>

            {!todasMarcadas && (
              <p className="text-center text-xs text-slate-400 mt-2">
                Marque todas as confirmações acima para habilitar a assinatura.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-slate-200 px-8 py-4 bg-slate-50 text-center">
            <p className="text-xs text-slate-400">
              Instituto Tia Pretinha · CNPJ 11.759.851/0001-39 · Este documento tem validade jurídica conforme Lei nº 14.063/2020
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}

function Section({ numero, titulo, children }: { numero: string; titulo: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-semibold text-slate-800 mb-2">
        {numero}. {titulo}
      </h3>
      <div className="text-slate-600">{children}</div>
    </div>
  );
}
