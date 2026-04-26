import { Controller, Get, UseGuards } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { JwtAuthGuard } from './auth/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from './auth/constants/roles.enum';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public()
  getHello() {
    return {
      status: '🚀 ITP ERP API - Online',
      uptime: `${Math.floor(process.uptime())} segundos`,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('sistema/monitoramento-ti')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.VP)
  monitoramentoTI() {
    return this.appService.monitoramentoTI();
  }
}
