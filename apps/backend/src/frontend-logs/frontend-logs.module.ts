import { Module } from '@nestjs/common';
import { FrontendLogsController } from './frontend-logs.controller';

@Module({
  controllers: [FrontendLogsController],
})
export class FrontendLogsModule {}
