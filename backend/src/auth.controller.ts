import { Controller, Get, Req } from '@nestjs/common';
import { Request } from 'express';

@Controller('auth')
export class AuthController {
  @Get('me')
  me(@Req() req: Request & { userId?: string; userEmail?: string; userRole?: string }) {
    return { id: req.userId, email: req.userEmail, role: req.userRole };
  }
}
