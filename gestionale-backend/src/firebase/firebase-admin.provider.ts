import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';

function getFirebaseCredential() {
  const configuredPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  const serviceAccountPath = configuredPath
    ? isAbsolute(configuredPath)
      ? configuredPath
      : resolve(process.cwd(), configuredPath)
    : resolve(process.cwd(), 'firebase-service-account.json');

  // In locale continuiamo a usare il JSON ignorato da Git, quando presente.
  if (existsSync(serviceAccountPath)) {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, 'utf8'),
    ) as admin.ServiceAccount;

    return admin.credential.cert(serviceAccount);
  }

  // Su Cloud Run usa automaticamente l'identità assegnata al servizio.
  return admin.credential.applicationDefault();
}

export const FirebaseAdminProvider: Provider = {
  provide: 'FIREBASE_ADMIN',
  useFactory: () => {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: getFirebaseCredential(),
        storageBucket:
          process.env.FIREBASE_STORAGE_BUCKET?.trim() ||
          'reboutique-gestionale.appspot.com',
      });
    }

    return admin;
  },
};
