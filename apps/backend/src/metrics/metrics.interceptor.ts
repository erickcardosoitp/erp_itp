import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

// Mede toda requisição HTTP (duração + contagem), labeled por
// method/route/status. Usa req.route?.path quando disponível (rota
// parametrizada, ex: /alunos/:id) em vez da URL crua — senão cada ID
// vira uma série temporal nova no Prometheus (cardinalidade explode).
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const inicio = process.hrtime.bigint();
    const method = req.method;
    const route = req.route?.path || req.baseUrl || req.path || 'desconhecida';

    const finalizar = () => {
      const duracaoSeg = Number(process.hrtime.bigint() - inicio) / 1e9;
      const statusCode = String(res.statusCode);
      this.metrics.httpDuration.observe({ method, route, status_code: statusCode }, duracaoSeg);
      this.metrics.httpCounter.inc({ method, route, status_code: statusCode });
    };

    return next.handle().pipe(tap({ next: finalizar, error: finalizar }));
  }
}
