// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { FirebaseModule } from '../firebase/firebase.module';
import { RolesGuard } from './roles.guard';
import { AuthController } from './auth.controller';

@Module({
  imports: [FirebaseModule],
  controllers: [AuthController],
  providers: [
    FirebaseAuthGuard,
    RolesGuard,
    Reflector,
  ],
  exports: [FirebaseAuthGuard, RolesGuard],
})
export class AuthModule {}
