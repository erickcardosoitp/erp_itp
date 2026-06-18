import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '../auth/constants/roles.enum';
import { ResponsaveisService } from './responsaveis.service';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('responsaveis')
export class ResponsaveisController {
  constructor(private readonly svc: ResponsaveisService) {}

  @Get()
  buscar(
    @Query('search') search?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.buscar(search, limit ? parseInt(limit, 10) : 20);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id);
  }

  @Post()
  @Roles(Role.ASSIST)
  criar(@Body() body: any) {
    return this.svc.criar(body);
  }

  @Patch(':id')
  @Roles(Role.ASSIST)
  atualizar(@Param('id') id: string, @Body() body: any) {
    return this.svc.atualizar(id, body);
  }

  @Delete(':id')
  @Roles(Role.DRT)
  desativar(@Param('id') id: string) {
    return this.svc.desativar(id);
  }
}
