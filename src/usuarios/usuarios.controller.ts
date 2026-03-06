import { 
  Controller, Patch, UseInterceptors, UploadedFile, 
  Body, HttpCode, HttpStatus, Req 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { AuthService } from '../auth/auth.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly authService: AuthService) {}
  
  @Patch('perfil')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('foto', {
    storage: diskStorage({
      // ✅ Salva o arquivo fisicamente na pasta public
      destination: join(process.cwd(), 'public/uploads/perfil'), 
      filename: (req: any, file: any, cb: any) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${uniqueSuffix}${extname(file.originalname)}`);
      },
    }),
  }))
  async updateProfile(
    @Body() data: { nome: string; email: string },
    @UploadedFile() file: any,
    @Req() req: any
  ) {
    // 🔍 Caminho relativo da foto para salvar no banco
    const fotoUrl = file ? `/uploads/perfil/${file.filename}` : undefined;

    // ✅ PERSISTÊNCIA REAL: Salva no Neon através do AuthService
    // O e-mail é usado como chave para encontrar o usuário
    const usuarioAtualizado = await this.authService.updateProfile(data.email, {
      nome: data.nome,
      fotoUrl: fotoUrl,
    });

    console.log(`[ITP LOG] Perfil persistido no banco para: ${data.email}`);

    // Retorna o usuário completo (com grupo e permissões) para o Frontend
    return usuarioAtualizado;
  }
}