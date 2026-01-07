import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [FirebaseModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, FirebaseAuthGuard, RolesGuard, Reflector],
})
export class PaymentsModule {}
