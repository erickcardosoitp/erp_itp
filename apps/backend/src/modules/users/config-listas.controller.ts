import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { ModuloPermGuard } from '../../auth/guards/modulo-perm.guard';
import { ModuloPerm } from '../../auth/decorators/modulo-perm.decorator';

@Controller('admin/config-listas')
@UseGuards(JwtAuthGuard, ModuloPermGuard)
@ModuloPerm('config', 'visualizar')
export class ConfigListasController {
  constructor(@InjectDataSource() private readonly ds: DataSource) {}

  @Get()
  async listarTodas() {
    const rows = await this.ds.query(`SELECT chave, itens FROM config_listas ORDER BY chave`);
    return rows;
  }

  @Get(':chave')
  async buscar(@Param('chave') chave: string) {
    const rows = await this.ds.query(`SELECT chave, itens FROM config_listas WHERE chave = $1`, [chave]);
    if (!rows.length) return { chave, itens: [] };
    return rows[0];
  }

  @Put(':chave')
  @ModuloPerm('config', 'editar')
  async salvar(@Param('chave') chave: string, @Body() body: { itens: string[] }) {
    const itens = JSON.stringify(body.itens ?? []);
    await this.ds.query(`
      INSERT INTO config_listas (chave, itens, updated_at) VALUES ($1, $2::jsonb, now())
      ON CONFLICT (chave) DO UPDATE SET itens = $2::jsonb, updated_at = now()
    `, [chave, itens]);
    return { chave, itens: body.itens };
  }
}
