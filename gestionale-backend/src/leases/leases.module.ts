import { Module } from '@nestjs/common';
import { LeasesService } from './leases.service';
import { LeasesController } from './leases.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [FirebaseModule],
  controllers: [LeasesController],
  providers: [LeasesService, FirebaseAuthGuard, RolesGuard, Reflector],
})
export class LeasesModule {}
