'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.itp.institutotiapretinha.org/api';

const ESCOLARIDADES = [
  'Ensino Fundamental Incompleto',
  'Ensino Fundamental Completo',
  'Ensino Médio Incompleto',
  'Ensino Médio Completo',
  'Ensino Superior Incompleto',
  'Ensino Superior Completo',
  'Pós-graduação',
];

const TURNOS = ['Manhã', 'Tarde', 'Noite', 'Integral', 'Não estudo no momento'];

const CUIDADOS = [
  'Não',
  'PCD',
  'TEA',
  'TDAH',
  'Deficiência Visual',
  'Deficiência Auditiva',
  'Deficiência Física/Motora',
  'Deficiência Intelectual',
  'Altas Habilidades',
  'Outro',
];

const PARENTESCOS = ['Mãe', 'Pai', 'Avó/Avô', 'Tia/Tio', 'Irmã/Irmão', 'Responsável Legal'];

const STEPS = [
  'Identificação',
  'Contato',
  'Endereço',
  'Saúde',
  'Cursos',
  'Termos',
];

interface FormData {
  nome_completo: string;
  cpf: string;
  data_nascimento: string;
  sexo: string;
  escolaridade: string;
  turno_escolar: string;
  email: string;
  celular: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado_uf: string;
  possui_alergias: string;
  cuidado_especial: string;
  uso_medicamento: string;
  detalhes_cuidado: string;
  nome_responsavel: string;
  email_responsavel: string;
  grau_parentesco: string;
  cpf_responsavel: string;
  telefone_alternativo: string;
  cursos_desejados: string;
  lgpd_aceito: boolean;
  autoriza_imagem: boolean;
}

const INITIAL: FormData = {
  nome_completo: '',
  cpf: '',
  data_nascimento: '',
  sexo: '',
  escolaridade: '',
  turno_escolar: '',
  email: '',
  celular: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado_uf: '',
  possui_alergias: '',
  cuidado_especial: 'Não',
  uso_medicamento: '',
  detalhes_cuidado: '',
  nome_responsavel: '',
  email_responsavel: '',
  grau_parentesco: '',
  cpf_responsavel: '',
  telefone_alternativo: '',
  cursos_desejados: '',
  lgpd_aceito: false,
  autoriza_imagem: false,
};

function calcularIdade(dataNasc: string): number {
  if (!dataNasc) return 99;
  const [ano, mes, dia] = dataNasc.split('-').map(Number);
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  if (
    hoje.getMonth() + 1 < mes ||
    (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)
  ) {
    idade--;
  }
  return idade;
}

function maskCPF(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
}

function maskPhone(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2');
}

function maskCEP(v: string) {
  return v
    .replace(/\D/g, '')
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, '$1-$2');
}

export default function InscricaoPage() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [cursos, setCursos] = useState<string[]>([]);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState(false);

  const menor18 = form.data_nascimento ? calcularIdade(form.data_nascimento) < 18 : false;

  useEffect(() => {
    fetch(`${API}/matriculas/cursos-disponiveis`)
      .then(r => r.json())
      .then((data: string[]) => setCursos(data))
      .catch(() => {});
  }, []);

  function set(field: keyof FormData, value: string | boolean) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function buscarCEP(cep: string) {
    const raw = cep.replace(/\D/g, '');
    if (raw.length !== 8) return;
    setBuscandoCEP(true);
    try {
      const r = await fetch(`https://viacep.com.br/ws/${raw}/json/`);
      const d = await r.json();
      if (!d.erro) {
        setForm(prev => ({
          ...prev,
          logradouro: d.logradouro || prev.logradouro,
          bairro: d.bairro || prev.bairro,
          cidade: d.localidade || prev.cidade,
          estado_uf: d.uf || prev.estado_uf,
        }));
      }
    } catch {}
    setBuscandoCEP(false);
  }

  function validarStep(): string {
    if (step === 0) {
      if (!form.nome_completo.trim() || form.nome_completo.trim().split(' ').length < 2)
        return 'Informe o nome completo (nome e sobrenome).';
    }
    if (step === 4) {
      if (!form.cursos_desejados.trim())
        return 'Selecione ou descreva ao menos um curso de interesse.';
    }
    if (step === 5) {
      if (!form.lgpd_aceito)
        return 'É necessário aceitar a Política de Privacidade para prosseguir.';
    }
    return '';
  }

  function avancar() {
    const msg = validarStep();
    if (msg) { setErro(msg); return; }
    setErro('');
    // Se não é menor de 18, pula a etapa de responsável embutida no step 3 (Saúde)
    setStep(s => s + 1);
  }

  function voltar() {
    setErro('');
    setStep(s => s - 1);
  }

  async function enviar() {
    const msg = validarStep();
    if (msg) { setErro(msg); return; }
    setErro('');
    setEnviando(true);
    try {
      const payload = {
        ...form,
        cpf: form.cpf.replace(/\D/g, ''),
        celular: form.celular.replace(/\D/g, ''),
        cep: form.cep.replace(/\D/g, ''),
        cpf_responsavel: form.cpf_responsavel.replace(/\D/g, ''),
        telefone_alternativo: form.telefone_alternativo.replace(/\D/g, ''),
        origem_inscricao: 'Site',
      };
      const r = await fetch(`${API}/matriculas/inscricao`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j?.message || 'Erro ao enviar inscrição.');
      }
      setSucesso(true);
    } catch (e: any) {
      setErro(e.message || 'Erro inesperado. Tente novamente.');
    } finally {
      setEnviando(false);
    }
  }

  if (sucesso) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Inscrição Enviada!</h1>
          <p className="text-gray-600 mb-4">
            Recebemos sua inscrição com sucesso. Em breve nossa equipe entrará em contato para dar continuidade ao processo de matrícula.
          </p>
          <p className="text-sm text-gray-500">
            Fique atento ao e-mail informado — enviaremos um termo de confirmação para assinatura digital.
          </p>
          <div className="mt-8 pt-6 border-t border-gray-100">
            <p className="text-xs text-gray-400">Instituto Tia Pretinha · {new Date().getFullYear()}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
            ITP
          </div>
          <div>
            <h1 className="font-bold text-gray-800 leading-tight">Instituto Tia Pretinha</h1>
            <p className="text-xs text-gray-500">Formulário de Inscrição {new Date().getFullYear()}</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Progress */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((label, i) => (
              <div key={i} className="flex flex-col items-center flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    i < step
                      ? 'bg-emerald-600 text-white'
                      : i === step
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {i < step ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`hidden sm:block absolute`} />
                )}
              </div>
            ))}
          </div>
          <div className="relative">
            <div className="h-1.5 bg-gray-200 rounded-full" />
            <div
              className="h-1.5 bg-emerald-600 rounded-full absolute top-0 left-0 transition-all"
              style={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            />
          </div>
          <p className="text-center text-sm text-emerald-700 font-medium mt-2">
            Etapa {step + 1} de {STEPS.length} — {STEPS[step]}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

          {/* Step 0: Identificação */}
          {step === 0 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-100">Dados Pessoais</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nome Completo <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome_completo}
                  onChange={e => set('nome_completo', e.target.value)}
                  placeholder="Digite seu nome e sobrenome"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                  <input
                    type="text"
                    value={form.cpf}
                    onChange={e => set('cpf', maskCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                  <input
                    type="date"
                    value={form.data_nascimento}
                    onChange={e => set('data_nascimento', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sexo</label>
                <div className="flex gap-4">
                  {['Masculino', 'Feminino', 'Outro'].map(op => (
                    <label key={op} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="sexo"
                        value={op}
                        checked={form.sexo === op}
                        onChange={() => set('sexo', op)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm text-gray-700">{op}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Escolaridade</label>
                <select
                  value={form.escolaridade}
                  onChange={e => set('escolaridade', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {ESCOLARIDADES.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Turno que estuda</label>
                <select
                  value={form.turno_escolar}
                  onChange={e => set('turno_escolar', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Selecione...</option>
                  {TURNOS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>
            </div>
          )}

          {/* Step 1: Contato */}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-100">Dados de Contato</h2>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  placeholder="seu@email.com"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Celular / WhatsApp</label>
                <input
                  type="tel"
                  value={form.celular}
                  onChange={e => set('celular', maskPhone(e.target.value))}
                  placeholder="(21) 99999-9999"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {menor18 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-4">
                  <p className="text-sm font-semibold text-amber-800">
                    Como o candidato é menor de 18 anos, preencha os dados do responsável:
                  </p>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Responsável</label>
                    <input
                      type="text"
                      value={form.nome_responsavel}
                      onChange={e => set('nome_responsavel', e.target.value)}
                      placeholder="Nome completo do responsável"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-mail do Responsável</label>
                    <input
                      type="email"
                      value={form.email_responsavel}
                      onChange={e => set('email_responsavel', e.target.value)}
                      placeholder="responsavel@email.com"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <p className="text-xs text-amber-700 mt-1">O termo de autorização será enviado para este e-mail.</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">CPF do Responsável</label>
                      <input
                        type="text"
                        value={form.cpf_responsavel}
                        onChange={e => set('cpf_responsavel', maskCPF(e.target.value))}
                        placeholder="000.000.000-00"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Grau de Parentesco</label>
                      <select
                        value={form.grau_parentesco}
                        onChange={e => set('grau_parentesco', e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      >
                        <option value="">Selecione...</option>
                        {PARENTESCOS.map(op => <option key={op} value={op}>{op}</option>)}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Telefone Alternativo</label>
                    <input
                      type="tel"
                      value={form.telefone_alternativo}
                      onChange={e => set('telefone_alternativo', maskPhone(e.target.value))}
                      placeholder="(21) 99999-9999"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Endereço */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-100">Endereço</h2>

              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">CEP</label>
                  <input
                    type="text"
                    value={form.cep}
                    onChange={e => {
                      const v = maskCEP(e.target.value);
                      set('cep', v);
                      if (v.replace(/\D/g, '').length === 8) buscarCEP(v);
                    }}
                    placeholder="00000-000"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div className="flex items-end pb-0.5">
                  {buscandoCEP && (
                    <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Logradouro</label>
                  <input
                    type="text"
                    value={form.logradouro}
                    onChange={e => set('logradouro', e.target.value)}
                    placeholder="Rua, Avenida, etc."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                  <input
                    type="text"
                    value={form.numero}
                    onChange={e => set('numero', e.target.value)}
                    placeholder="123"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Complemento</label>
                <input
                  type="text"
                  value={form.complemento}
                  onChange={e => set('complemento', e.target.value)}
                  placeholder="Apto, Bloco, Casa..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Bairro</label>
                <input
                  type="text"
                  value={form.bairro}
                  onChange={e => set('bairro', e.target.value)}
                  placeholder="Nome do bairro"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Cidade</label>
                  <input
                    type="text"
                    value={form.cidade}
                    onChange={e => set('cidade', e.target.value)}
                    placeholder="Rio de Janeiro"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">UF</label>
                  <input
                    type="text"
                    value={form.estado_uf}
                    onChange={e => set('estado_uf', e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="RJ"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Saúde */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-100">Saúde e Bem-estar</h2>
              <p className="text-sm text-gray-500">Essas informações nos ajudam a garantir um atendimento adequado.</p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Possui alergias?</label>
                <div className="flex gap-6">
                  {['Sim', 'Não'].map(op => (
                    <label key={op} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="alergias"
                        value={op}
                        checked={form.possui_alergias === op}
                        onChange={() => set('possui_alergias', op)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm text-gray-700">{op}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Faz uso de algum medicamento?</label>
                <div className="flex gap-6">
                  {['Sim', 'Não'].map(op => (
                    <label key={op} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="medicamento"
                        value={op}
                        checked={form.uso_medicamento === op}
                        onChange={() => set('uso_medicamento', op)}
                        className="accent-emerald-600"
                      />
                      <span className="text-sm text-gray-700">{op}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Necessidade de cuidado especial</label>
                <select
                  value={form.cuidado_especial}
                  onChange={e => set('cuidado_especial', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {CUIDADOS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
              </div>

              {(form.possui_alergias === 'Sim' || form.uso_medicamento === 'Sim' || form.cuidado_especial !== 'Não') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Descreva (alergias, medicamentos, cuidados)</label>
                  <textarea
                    value={form.detalhes_cuidado}
                    onChange={e => set('detalhes_cuidado', e.target.value)}
                    placeholder="Informe detalhes relevantes para nossa equipe..."
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Cursos */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-100">Cursos de Interesse <span className="text-red-500">*</span></h2>
              <p className="text-sm text-gray-500">Selecione os cursos ou projetos que deseja participar.</p>

              {cursos.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {cursos.map(curso => {
                    const selecionados = form.cursos_desejados
                      ? form.cursos_desejados.split(',').map(s => s.trim()).filter(Boolean)
                      : [];
                    const marcado = selecionados.includes(curso);
                    return (
                      <label
                        key={curso}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          marcado
                            ? 'border-emerald-500 bg-emerald-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={marcado}
                          onChange={() => {
                            const lista = selecionados.filter(s => s);
                            if (marcado) {
                              set('cursos_desejados', lista.filter(s => s !== curso).join(', '));
                            } else {
                              set('cursos_desejados', [...lista, curso].join(', '));
                            }
                          }}
                          className="accent-emerald-600"
                        />
                        <span className="text-sm text-gray-700">{curso}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {cursos.length > 0 ? 'Outros cursos ou observações' : 'Cursos de interesse'}
                </label>
                <textarea
                  value={cursos.length > 0
                    ? form.cursos_desejados.split(',').filter(s => !cursos.includes(s.trim())).join(', ')
                    : form.cursos_desejados}
                  onChange={e => {
                    if (cursos.length > 0) {
                      const selecionados = form.cursos_desejados
                        .split(',').map(s => s.trim()).filter(s => cursos.includes(s));
                      const extras = e.target.value;
                      set('cursos_desejados', [...selecionados, extras].filter(Boolean).join(', '));
                    } else {
                      set('cursos_desejados', e.target.value);
                    }
                  }}
                  placeholder="Ex: Informática, Futebol, Dança..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                />
              </div>
            </div>
          )}

          {/* Step 5: Termos */}
          {step === 5 && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold text-gray-800 pb-2 border-b border-gray-100">Termos e Consentimentos</h2>

              <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600 leading-relaxed space-y-2">
                <p><strong>Política de Privacidade (LGPD)</strong></p>
                <p>
                  O Instituto Tia Pretinha coleta seus dados pessoais com a finalidade de realizar o processo de inscrição e matrícula, conforme a Lei nº 13.709/2018 (LGPD).
                  Seus dados serão utilizados exclusivamente para fins institucionais, como comunicação, acompanhamento pedagógico e emissão de documentos.
                  Você tem o direito de acessar, corrigir ou solicitar a exclusão de seus dados a qualquer momento.
                </p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.lgpd_aceito}
                  onChange={e => set('lgpd_aceito', e.target.checked)}
                  className="accent-emerald-600 mt-0.5 w-4 h-4 flex-shrink-0"
                />
                <span className="text-sm text-gray-700">
                  Li e concordo com a Política de Privacidade do Instituto Tia Pretinha e autorizo o uso dos meus dados para finalidades institucionais. <span className="text-red-500">*</span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.autoriza_imagem}
                  onChange={e => set('autoriza_imagem', e.target.checked)}
                  className="accent-emerald-600 mt-0.5 w-4 h-4 flex-shrink-0"
                />
                <span className="text-sm text-gray-700">
                  Autorizo o Instituto Tia Pretinha a utilizar minha imagem, voz e registros audiovisuais em materiais institucionais, redes sociais e comunicações do Instituto. (opcional)
                </span>
              </label>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm text-emerald-800">
                <strong>Próximos passos após o envio:</strong>
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>Nossa equipe analisará sua inscrição</li>
                  <li>Você receberá um e-mail com o termo de confirmação para assinar digitalmente</li>
                  <li>Após a assinatura, será solicitado o envio de documentos</li>
                  <li>Com tudo validado, você estará matriculado(a)!</li>
                </ol>
              </div>
            </div>
          )}

          {/* Erro */}
          {erro && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {erro}
            </div>
          )}

          {/* Navegação */}
          <div className="flex justify-between mt-6 pt-5 border-t border-gray-100">
            <button
              onClick={voltar}
              disabled={step === 0}
              className="px-5 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Voltar
            </button>

            {step < STEPS.length - 1 ? (
              <button
                onClick={avancar}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors"
              >
                Continuar →
              </button>
            ) : (
              <button
                onClick={enviar}
                disabled={enviando}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {enviando ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Enviando...
                  </>
                ) : (
                  'Enviar Inscrição ✓'
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Instituto Tia Pretinha · Formulário Oficial de Inscrição {new Date().getFullYear()}
        </p>
      </main>
    </div>
  );
}
