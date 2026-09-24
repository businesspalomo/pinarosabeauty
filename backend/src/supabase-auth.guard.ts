import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createClient } from '@supabase/supabase-js';
import { CoreService } from './core.service';
import { IS_PUBLIC_KEY } from './public.decorator';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!);

  constructor(private readonly reflector: Reflector, private readonly core: CoreService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest();
    const authHeader: string | undefined = req.headers['authorization'];
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new UnauthorizedException('Falta el token de autenticación');

    const { data, error } = await this.supabase.auth.getUser(token);
    if (error || !data.user) throw new UnauthorizedException('Sesión inválida o expirada');

    const email = data.user.email || `${data.user.id}@sin-email.local`;
    const name = (data.user.user_metadata?.name as string) || email;
    const appUser = await this.core.ensureUser(data.user.id, email, name);

    req.userId = appUser.id;
    req.userEmail = appUser.email;
    req.userRole = appUser.role;
    return true;
  }
}
