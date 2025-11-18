import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { RolesGuard } from './roles.guard';

@Controller('auth')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AuthController {
  @Get('me')
  // nessun @Roles: basta essere autenticati
  me(@Req() req) {
    const user = req.user as {
      uid: string;
      email?: string;
      role: 'HOLDER' | 'TENANT';
      holderId?: string;
    };
    return user;
  }
}
