// src/auth/firebase-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../firebase/firebase.service';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  constructor(private readonly firebaseService: FirebaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    if (!token) {
      throw new UnauthorizedException('Missing auth token');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(token);
      const uid = decodedToken.uid;
      const firestore = this.firebaseService.firestore;

      // 1) Leggi o crea il profilo in users/{uid}
      const userRef = firestore.collection('users').doc(uid);
      const userDoc = await userRef.get();

      let userData: { role: 'HOLDER' | 'TENANT'; holderId?: string };

      if (!userDoc.exists) {
        // Utente nuovo → per default è un TENANT
        userData = {
          role: 'TENANT',
        };
        await userRef.set({
          ...userData,
          createdAt: new Date(),
          email: decodedToken.email ?? null,
        });
      } else {
        const raw = userDoc.data() as {
          role?: 'HOLDER' | 'TENANT';
          holderId?: string;
        };
        if (!raw.role) {
          throw new ForbiddenException('User role not set');
        }
        userData = {
          role: raw.role,
          holderId: raw.holderId,
        };
      }

      request.user = {
        uid,
        email: decodedToken.email,
        role: userData.role,
        holderId: userData.holderId,
        firebase: decodedToken,
      };

      return true;
    } catch (err: any) {
      if (err instanceof UnauthorizedException || err instanceof ForbiddenException) {
        throw err;
      }
      throw new UnauthorizedException(
        `Auth guard error: ${err?.message ?? 'Invalid auth token'}`,
      );
    }
  }
}
