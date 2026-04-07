import { Injectable, Logger, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pesquisa, PerguntaPesquisa } from './pesquisa.entity';
import { PesquisaResposta, RespostaPergunta } from './pesquisa-resposta.entity';

@Injectable()
export class PesquisasService {
  private readonly logger = new Logger(PesquisasService.name);

  constructor(
    @InjectRepository(Pesquisa) private pesquisaRepo: Repository<Pesquisa>,
    @InjectRepository(PesquisaResposta) private respostaRepo: Repository<PesquisaResposta>,
  ) {}

  private gerarLink(): string {
    const parte1 = Date.now().toString(36);
    const parte2 = Math.random().toString(36).substring(2, 8);
    return `${parte1}-${parte2}`;
  }

  async npsAtual(): Promise<{ nps: number | null; total_respostas: number; pesquisa_titulo?: string }> {
    const pesquisa = await this.pesquisaRepo.findOne({
      where: { tipo: 'Interna', categoria: 'Academico' } as any,
      order: { created_at: 'DESC' },
    });
    if (!pesquisa) return { nps: null, total_respostas: 0 };
    const todasRespostas = await this.respostaRepo.find({ where: { pesquisa_id: pesquisa.id } });
    const respostas = todasRespostas.filter(r => !r.expurgado);
    const perguntasNota = (pesquisa.perguntas || []).filter(p => p.tipo === 'nota');
    if (!perguntasNota.length || !respostas.length) return { nps: null, total_respostas: todasRespostas.length, pesquisa_titulo: pesquisa.titulo };
    const allNotas: number[] = [];
    for (const resposta of respostas) {
      for (const p of perguntasNota) {
        const r = resposta.respostas.find(rp => rp.pergunta_id === p.id);
        if (r?.nota != null) allNotas.push(r.nota);
      }
    }
    const media = allNotas.length ? allNotas.reduce((a, b) => a + b, 0) / allNotas.length : null;
    return { nps: media != null ? parseFloat(media.toFixed(1)) : null, total_respostas: todasRespostas.length, pesquisa_titulo: pesquisa.titulo };
  }

  async expurgarResposta(id: string, expurgado: boolean) {
    const resposta = await this.respostaRepo.findOneBy({ id });
    if (!resposta) throw new NotFoundException('Resposta não encontrada');
    await this.respostaRepo.update(id, { expurgado });
    return { ok: true, expurgado };
  }

  async criar(dto: {
    titulo: string;
    tipo: string;
    categoria?: string;
    perguntas: PerguntaPesquisa[];
    data_limite?: string;
  }, usuario: { id: string; nome: string }) {
    if (!dto.titulo?.trim()) throw new BadRequestException('Título é obrigatório');
    if (!dto.tipo) throw new BadRequestException('Tipo é obrigatório');
    if (!dto.perguntas?.length) throw new BadRequestException('É obrigatório ter ao menos uma pergunta');

    let link_unico: string;
    let tentativas = 0;
    do {
      link_unico = this.gerarLink();
      tentativas++;
      if (tentativas > 10) throw new BadRequestException('Erro ao gerar link único');
    } while (await this.pesquisaRepo.findOneBy({ link_unico }));

    const pesquisa = this.pesquisaRepo.create({
      titulo: dto.titulo.trim(),
      tipo: dto.tipo,
      categoria: dto.categoria || null,
      perguntas: dto.perguntas,
      ...(dto.data_limite ? { data_limite: new Date(dto.data_limite) } : {}),
      status: 'aberta',
      link_unico,
      criado_por_id: usuario.id ?? undefined,
      criado_por_nome: usuario.nome ?? undefined,
    });

    const salva = await this.pesquisaRepo.save(pesquisa);
    this.logger.log(`Pesquisa criada: ${salva.titulo} | link=${salva.link_unico}`);
    return salva;
  }

  async listar() {
    const pesquisas = await this.pesquisaRepo.find({ order: { created_at: 'DESC' } });
    // Adiciona contagem de respostas em cada pesquisa
    const comContagem = await Promise.all(
      pesquisas.map(async (p) => {
        const total_respostas = await this.respostaRepo.count({ where: { pesquisa_id: p.id } });
        // Verifica se expirou
        const expirada = p.data_limite && new Date() > new Date(p.data_limite);
        return { ...p, total_respostas, expirada };
      })
    );
    return comContagem;
  }

  async buscarResultados(id: string) {
    const pesquisa = await this.pesquisaRepo.findOneBy({ id });
    if (!pesquisa) throw new NotFoundException('Pesquisa não encontrada');

    const respostas = await this.respostaRepo.find({ where: { pesquisa_id: id }, order: { created_at: 'DESC' } });

    // Calcular médias por pergunta
    const stats = (pesquisa.perguntas || []).map(p => {
      if (p.tipo === 'nota') {
        const notas = respostas
          .filter(r => !r.expurgado)
          .map(r => r.respostas.find(rp => rp.pergunta_id === p.id)?.nota)
          .filter((n): n is number => n != null);
        const media = notas.length ? (notas.reduce((a, b) => a + b, 0) / notas.length) : null;
        const distribuicao = [1, 2, 3, 4, 5].map(v => ({
          nota: v,
          total: notas.filter(n => n === v).length,
        }));
        return { ...p, media, total_respostas: notas.length, distribuicao };
      } else if (p.tipo === 'multipla_escolha' || p.tipo === 'checkbox') {
        // Contagem por opção
        const contagem: Record<string, number> = {};
        for (const opc of (p.opcoes || [])) contagem[opc] = 0;
        for (const resposta of respostas) {
          const rp = resposta.respostas.find(rp => rp.pergunta_id === p.id);
          if (rp?.opcoes_selecionadas) {
            for (const opc of rp.opcoes_selecionadas) {
              contagem[opc] = (contagem[opc] || 0) + 1;
            }
          }
        }
        return { ...p, contagem, total_respostas: respostas.filter(r => r.respostas.some(rp => rp.pergunta_id === p.id && rp.opcoes_selecionadas?.length)).length };
      } else {
        const textos = respostas
          .map(r => r.respostas.find(rp => rp.pergunta_id === p.id)?.texto)
          .filter((t): t is string => !!t);
        return { ...p, textos, total_respostas: textos.length };
      }
    });

    return { pesquisa, total_respostas: respostas.length, stats, respostas };
  }

  async buscarPublico(link: string) {
    const pesquisa = await this.pesquisaRepo.findOneBy({ link_unico: link });
    if (!pesquisa) throw new NotFoundException('Pesquisa não encontrada');

    if (pesquisa.status === 'encerrada') {
      throw new ForbiddenException('Esta pesquisa está encerrada');
    }
    if (pesquisa.data_limite && new Date() > new Date(pesquisa.data_limite)) {
      throw new ForbiddenException('O prazo desta pesquisa expirou');
    }

    // Retorna apenas o necessário para responder (sem dados de criação)
    return {
      id: pesquisa.id,
      titulo: pesquisa.titulo,
      tipo: pesquisa.tipo,
      perguntas: pesquisa.perguntas,
      data_limite: pesquisa.data_limite,
    };
  }

  async responder(link: string, respostas: RespostaPergunta[]) {
    const pesquisa = await this.pesquisaRepo.findOneBy({ link_unico: link });
    if (!pesquisa) throw new NotFoundException('Pesquisa não encontrada');

    if (pesquisa.status === 'encerrada') {
      throw new ForbiddenException('Esta pesquisa está encerrada');
    }
    if (pesquisa.data_limite && new Date() > new Date(pesquisa.data_limite)) {
      throw new ForbiddenException('O prazo desta pesquisa expirou');
    }
    if (!respostas?.length) throw new BadRequestException('Respostas são obrigatórias');

    const resposta = this.respostaRepo.create({ pesquisa_id: pesquisa.id, respostas });
    await this.respostaRepo.save(resposta);
    this.logger.log(`Resposta registrada para pesquisa ${pesquisa.id}`);
    return { ok: true, mensagem: 'Resposta registrada com sucesso!' };
  }

  async encerrar(id: string) {
    const pesquisa = await this.pesquisaRepo.findOneBy({ id });
    if (!pesquisa) throw new NotFoundException('Pesquisa não encontrada');
    await this.pesquisaRepo.update(id, { status: 'encerrada' });
    this.logger.log(`Pesquisa encerrada: ${id}`);
    return { ok: true };
  }

  async reiniciar(id: string) {
    const pesquisa = await this.pesquisaRepo.findOneBy({ id });
    if (!pesquisa) throw new NotFoundException('Pesquisa não encontrada');
    await this.pesquisaRepo.update(id, { status: 'aberta' });
    this.logger.log(`Pesquisa reaberta: ${id}`);
    return { ok: true };
  }

  async deletar(id: string) {
    const pesquisa = await this.pesquisaRepo.findOneBy({ id });
    if (!pesquisa) throw new NotFoundException('Pesquisa não encontrada');
    await this.respostaRepo.delete({ pesquisa_id: id });
    await this.pesquisaRepo.delete(id);
    return { ok: true };
  }
}
