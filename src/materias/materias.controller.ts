import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { MateriasService } from './materias.service';
import { Materia } from '../materia.entity';

@Controller('materias')
export class MateriasController {
  constructor(private readonly materiasService: MateriasService) {}

  @Post()
  async create(@Body() dados: Partial<Materia>) {
    return await this.materiasService.create(dados);
  }

  @Get()
  async findAll() {
    return await this.materiasService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.materiasService.findOne(id);
  }

  @Patch(':id/progresso')
  async updateProgress(
    @Param('id') id: string, 
    @Body('progresso') progresso: number
  ) {
    return await this.materiasService.updateProgress(id, progresso);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    return await this.materiasService.remove(id);
  }
}