import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

/**
 * Interceptor que envuelve las respuestas exitosas en un formato estándar.
 * Las respuestas paginadas (con meta) se pasan tal cual.
 */
@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<
  T,
  ApiResponse<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((payload): ApiResponse<T> => {
        const timestamp = new Date().toISOString();

        // Si ya tiene la forma { data, meta } (paginado), no volver a envolver
        const isPaginated =
          typeof payload === 'object' &&
          payload !== null &&
          'data' in payload &&
          'meta' in payload;

        return isPaginated
          ? ({
              success: true,
              ...(payload as object),
              timestamp,
            } as ApiResponse<T>)
          : { success: true, data: payload, timestamp };
      }),
    );
  }
}
