import { Global, Module } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { join } from 'path';
import { FirebaseService } from './firebase.service';

@Global()
@Module({
  providers: [
    FirebaseService,
    {
      provide: 'FIREBASE_ADMIN',
      useFactory: () => {
        // Path assoluto al file JSON, partendo dalla root del progetto
        const serviceAccountPath = join(
          process.cwd(), // C:\Users\zaopo\development\gestionale-backend
          'firebase-service-account.json',
        );

        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccountPath),
          });
        }

        return admin;
      },
    },
  ],
  exports: ['FIREBASE_ADMIN', FirebaseService],
})
export class FirebaseModule {}


