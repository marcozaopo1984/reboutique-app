import { Module } from '@nestjs/common';
import { ExpensesService } from './expenses.service';
import { ExpensesController } from './expenses.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [FirebaseModule],
  controllers: [ExpensesController],
  providers: [ExpensesService, FirebaseAuthGuard, RolesGuard, Reflector],
})
export class ExpensesModule {}
