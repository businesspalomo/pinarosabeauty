import { Controller, Get } from '@nestjs/common';
import { DatabaseService } from './database.service';
import { Public } from './public.decorator';

@Controller('health')
export class HealthController {
  constructor(private db: DatabaseService) {}

  @Public()
  @Get()
  async health() {
    const r = await this.db.query<{ now: string }>('select now()::text as now');
    return { ok: true, service: 'pina-rosa-api', database: 'ok', time: r.rows[0].now };
  }
}
