import { ArgumentsHost, Catch, HttpStatus, Logger } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';

// Convierte los errores de Postgres en un mensaje legible en lugar de "Internal server error",
// para que el error se vea en pantalla y quede en los logs con su detalle.
@Catch()
export class DbErrorFilter extends BaseExceptionFilter {
  private readonly logger = new Logger('DbError');

  catch(error: any, host: ArgumentsHost) {
    const isPg = error && typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code) && error.severity;
    if (!isPg) return super.catch(error, host);
    this.logger.error(`${error.code} ${error.message} ${error.detail || ''} (tabla ${error.table || '-'}, regla ${error.constraint || '-'})`);
    const status = error.code === '23505' || error.code === '23503' ? HttpStatus.CONFLICT
      : error.code.startsWith('22') || error.code.startsWith('23') ? HttpStatus.BAD_REQUEST
      : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = error.code === '23505' ? `Ya existe un registro con ese dato (${error.constraint || 'duplicado'}). ${error.detail || ''}`.trim()
      : `Error de base de datos (${error.code}): ${error.message}`;
    host.switchToHttp().getResponse().status(status).json({ statusCode: status, message });
  }
}
