import {
  Controller, Patch, UseInterceptors, UploadedFile,
  Body, HttpCode, HttpStatus, Req, Get, BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AuthService } from '../auth/auth.service';

const FOTO_MAX_BYTES = 3 * 1024 * 1024; // 3 MB — base64 fica ~4 MB no banco
const FOTO_MIMETYPES = ['image/jpeg', 'image/png', 'image/webp'];

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly authService: AuthService) {}

  @Get('perfil')
  @HttpCode(HttpStatus.OK)
  async getProfile(@Req() req: any) {
    return this.authService.getProfile(req.user.userId);
  }

  @Patch('perfil')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('foto', {
    storage: memoryStorage(),
    limits: { fileSize: FOTO_MAX_BYTES },
  }))
  async updateProfile(
    @Body() data: { nome: string },
    @UploadedFile() file: any,
    @Req() req: any,
  ) {
    let fotoUrl: string | undefined;
    if (file) {
      if (!FOTO_MIMETYPES.includes(file.mimetype)) {
        throw new BadRequestException('Formato de imagem inválido. Use JPEG, PNG ou WebP.');
      }
      fotoUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    }

    return this.authService.updateProfile(req.user.userId, { nome: data.nome, fotoUrl });
  }
}