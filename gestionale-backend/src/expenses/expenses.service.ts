import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { CreateExpenseFileDto } from './dto/create-expense-file.dto';
import * as admin from 'firebase-admin';

@Injectable()
export class ExpensesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private collection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('expenses');
  }

  // ---- files subcollection ----
  private expenseFilesCollection(holderId: string, expenseId: string) {
    return this.collection(holderId).doc(expenseId).collection('files');
  }

  private clean(data: any) {
    const out: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) out[key] = val;
    }
    return out;
  }

  // ---- CRUD ----
  async create(holderId: string, dto: CreateExpenseDto) {
    const col = this.collection(holderId);
    const data = this.clean({
      ...dto,
      status: dto.status ?? 'PLANNED',
      currency: dto.currency ?? 'EUR',
      createdAt: new Date(),
      updatedAt: new Date(),
      paidDate: dto.paidDate,
    });

    const ref = await col.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const snap = await this.collection(holderId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, id: string) {
    const doc = await this.collection(holderId).doc(id).get();
    if (!doc.exists) throw new NotFoundException('Expense not found');
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, id: string, dto: UpdateExpenseDto) {
    const ref = this.collection(holderId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Expense not found');

    const data = this.clean({
      ...dto,
      updatedAt: new Date(),
    });

    await ref.set(data, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...(updated.data() as any) };
  }

  async remove(holderId: string, id: string) {
    const ref = this.collection(holderId).doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException('Expense not found');

    await ref.delete();
    return { success: true };
  }

  // ---- FILES endpoints ----
  async addFile(holderId: string, expenseId: string, dto: CreateExpenseFileDto) {
    // verifica expense esiste
    const expRef = this.collection(holderId).doc(expenseId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) throw new NotFoundException(`Expense ${expenseId} not found`);

    const filesCol = this.expenseFilesCollection(holderId, expenseId);
    const data = this.clean({
      ...dto,
      createdAt: new Date(),
    });

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, expenseId: string) {
    // opzionale: verifica expense esiste
    const expRef = this.collection(holderId).doc(expenseId);
    const expSnap = await expRef.get();
    if (!expSnap.exists) throw new NotFoundException(`Expense ${expenseId} not found`);

    const snap = await this.expenseFilesCollection(holderId, expenseId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async removeFile(holderId: string, expenseId: string, fileId: string) {
    const filesCol = this.expenseFilesCollection(holderId, expenseId);
    const ref = filesCol.doc(fileId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`File ${fileId} not found`);

    const data = doc.data() as any;
    const storagePath: string | undefined = data?.storagePath ?? data?.path;

    // delete fisico storage
    if (storagePath) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storagePath).delete({ ignoreNotFound: true } as any);
      } catch (err) {
        console.error('Errore delete Storage file:', storagePath, (err as any)?.message ?? err);
      }
    }

    // delete metadata firestore
    await ref.delete();
    return { success: true };
  }
}
