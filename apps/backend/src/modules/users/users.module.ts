import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { Usuario } from '../../usuarios/usuario.entity';
import { EmailService } from '../../email.service';

@Module({
  imports: [TypeOrmModule.forFeature([Usuario])],
  providers: [UsersService, EmailService],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}
