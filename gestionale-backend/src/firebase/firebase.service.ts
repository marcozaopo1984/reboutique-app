import { Inject, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService {
  constructor(
    @Inject('FIREBASE_ADMIN') private readonly firebaseAdmin: typeof admin,
  ) {}

  get firestore() {
    return this.firebaseAdmin.firestore();
  }

  get auth() {
    return this.firebaseAdmin.auth();
  }

  // opzionale: esporre admin grezzo
  get admin() {
    return this.firebaseAdmin;
  }
}
