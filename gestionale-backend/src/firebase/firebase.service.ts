import { Inject, Injectable } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { Firestore, getFirestore } from 'firebase-admin/firestore';

@Injectable()
export class FirebaseService {
  private readonly _firestore: Firestore;  // <--- proprietà dichiarata QUI

  constructor(
    @Inject('FIREBASE_ADMIN')
    private readonly firebaseAdmin: typeof admin,
  ) {
    
    // Qui diciamo a firebase-admin: usa il database Firestore con ID "default"
    // (quello che vedi nella tua console Firebase → Firestore → Databases)
    this._firestore = getFirestore(this.firebaseAdmin.app(), 'default');
  }

  // Getter per ottenere Firestore
  get firestore(): Firestore {
    return this._firestore;
  }

  // Getter Auth
  get auth() {
    return this.firebaseAdmin.auth();
  }

  // Opzionale: espone admin grezzo
  get admin() {
    return this.firebaseAdmin;
  }
}

