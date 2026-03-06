import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @Public() 
  getHello() {
    return {
      status: '🚀 ITP ERP API - Online',
      uptime: `${Math.floor(process.uptime())} segundos`,
      timestamp: new Date().toISOString()
    };
  }
}