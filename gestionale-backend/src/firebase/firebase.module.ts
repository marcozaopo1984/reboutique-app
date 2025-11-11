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
        const serviceAccount = require(join(
          process.cwd(),
          'firebase-service-account.json',
        ));

        if (!admin.apps.length) {
          admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
          });
        }

        return admin;
      },
    },
  ],
  exports: ['FIREBASE_ADMIN', FirebaseService],
})
export class FirebaseModule {}
