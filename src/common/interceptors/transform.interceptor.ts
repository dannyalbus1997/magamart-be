import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    return next.handle().pipe(
      map((raw) => {
        const { message, data, ...rest } = raw ?? {};
        return {
          success: true,
          message: message || 'Operation successful',
          data: data !== undefined ? data : raw,
          ...rest, // preserves pagination fields: total, page, limit, totalPages
        };
      }),
    );
  }
}
