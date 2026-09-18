import {
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  InternalServerErrorException,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FieldValue } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateHolderUserDto } from './dto/create-holder-user.dto';
import { FirebaseAuthGuard } from './firebase-auth.guard';
import { Roles } from './roles.decorator';
import { RolesGuard } from './roles.guard';

type AuthenticatedUser = {
  uid: string;
  email?: string;
  role: 'HOLDER' | 'TENANT';
  holderId?: string;
};

@Controller('auth')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class AuthController {
  constructor(private readonly firebaseService: FirebaseService) {}

  @Get('me')
  // nessun @Roles: basta essere autenticati
  me(@Req() req) {
    const user = req.user as AuthenticatedUser;
    return user;
  }

  /**
   * Elenca le utenze HOLDER associate allo stesso holder dell'utente corrente.
   * Supporta sia il campo canonico holderID sia il vecchio holderId.
   */
  @Get('holder-users')
  @Roles('HOLDER')
  async listHolderUsers(@Req() req) {
    const currentUser = req.user as AuthenticatedUser;
    const holderId = currentUser.holderId;

    if (!holderId) {
      throw new ForbiddenException('holderID non configurato per questo utente');
    }

    const usersRef = this.firebaseService.firestore.collection('users');
    const [canonicalSnap, legacySnap] = await Promise.all([
      usersRef.where('holderID', '==', holderId).get(),
      usersRef.where('holderId', '==', holderId).get(),
    ]);

    const byUid = new Map<string, any>();

    for (const doc of [...canonicalSnap.docs, ...legacySnap.docs]) {
      const data = doc.data() as any;
      if (data.role !== 'HOLDER') continue;

      const createdAt = data.createdAt?.toDate
        ? data.createdAt.toDate().toISOString()
        : data.createdAt instanceof Date
          ? data.createdAt.toISOString()
          : data.createdAt ?? null;

      byUid.set(doc.id, {
        uid: doc.id,
        email: data.email ?? null,
        displayName: data.displayName ?? null,
        role: data.role,
        holderId,
        createdAt,
        isCurrentUser: doc.id === currentUser.uid,
      });
    }

    return Array.from(byUid.values()).sort((a, b) => {
      if (a.isCurrentUser !== b.isCurrentUser) return a.isCurrentUser ? -1 : 1;
      return String(a.email ?? '').localeCompare(String(b.email ?? ''));
    });
  }

  /**
   * Crea una nuova utenza HOLDER e la associa AUTOMATICAMENTE allo stesso holderID
   * dell'utente HOLDER che esegue la richiesta.
   *
   * La password iniziale e' casuale e non viene restituita. Il frontend invia poi
   * la mail Firebase di reimpostazione password all'indirizzo appena creato.
   */
  @Post('holder-users')
  @Roles('HOLDER')
  async createHolderUser(@Req() req, @Body() dto: CreateHolderUserDto) {
    const currentUser = req.user as AuthenticatedUser;
    const holderId = currentUser.holderId;

    if (!holderId) {
      throw new ForbiddenException('holderID non configurato per questo utente');
    }

    const email = dto.email.trim().toLowerCase();
    const displayName = dto.displayName?.trim() || undefined;

    // Password volutamente non conoscibile dall'operatore che crea l'utenza.
    // Il nuovo utente ricevera' una mail Firebase per impostarne una propria.
    const bootstrapPassword = `${randomBytes(32).toString('base64url')}Aa1!`;

    let createdAuthUser: { uid: string } | null = null;

    try {
      const authUser = await this.firebaseService.auth.createUser({
        email,
        password: bootstrapPassword,
        displayName,
        emailVerified: false,
      });
      createdAuthUser = { uid: authUser.uid };

      await this.firebaseService.firestore.collection('users').doc(authUser.uid).set({
        email,
        displayName: displayName ?? null,
        role: 'HOLDER',
        holderID: holderId,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: currentUser.uid,
      });

      return {
        uid: authUser.uid,
        email,
        displayName: displayName ?? null,
        role: 'HOLDER' as const,
        holderId,
      };
    } catch (err: any) {
      // Se Authentication e' stato creato ma la scrittura Firestore fallisce,
      // rimuoviamo l'account per non lasciare un utente orfano.
      if (createdAuthUser) {
        try {
          await this.firebaseService.auth.deleteUser(createdAuthUser.uid);
        } catch {
          // Non mascheriamo l'errore originario.
        }
      }

      if (err?.code === 'auth/email-already-exists') {
        throw new ConflictException('Esiste già un utente Firebase con questa email');
      }
      if (err?.code === 'auth/invalid-email') {
        throw new ConflictException('Email non valida');
      }

      throw new InternalServerErrorException(
        err?.message ?? 'Errore durante la creazione dell’utente',
      );
    }
  }
}
