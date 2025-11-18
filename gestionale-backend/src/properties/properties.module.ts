import { Module } from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { PropertiesController } from './properties.controller';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Reflector } from '@nestjs/core';

@Module({
  imports: [FirebaseModule],
  controllers: [PropertiesController],
  providers: [PropertiesService, FirebaseAuthGuard, RolesGuard, Reflector],
})
export class PropertiesModule {}
