import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

const LIMIT = 1_000_000; // 1MB — bem abaixo do limite Vercel (4.5MB)

@Injectable()
export class PayloadSizeInterceptor implements NestInterceptor {
  private readonly logger = new Logger(PayloadSizeInterceptor.name);

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map(data => {
        if (data == null) return data;
        try {
          const str = JSON.stringify(data);
          const bytes = Buffer.byteLength(str, 'utf8');
          if (bytes > LIMIT) {
            const req = ctx.switchToHttp().getRequest();
            this.logger.error(`[PAYLOAD_INTERCEPTOR] ${req?.method} ${req?.url}: ${bytes} bytes — truncating`);
            if (Array.isArray(data)) {
              return data.map((d: any) => ({
                id: d?.id,
                tipo: d?.tipo,
                fisico: d?.fisico ?? false,
                signed_url: null,
                source: d?.source,
              }));
            }
            return { error: 'PAYLOAD_TOO_LARGE', bytes };
          }
        } catch { /* ignore serialization errors — let NestJS handle */ }
        return data;
      }),
    );
  }
}
