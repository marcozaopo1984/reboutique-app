import { Module } from '@nestjs/common';
import { FirebaseService } from './firebase.service';
import { FirebaseAdminProvider } from './firebase-admin.provider';

@Module({
  providers: [FirebaseAdminProvider, FirebaseService],
  exports: [FirebaseService],
})
export class FirebaseModule {}
