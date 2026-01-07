import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';

@Injectable()
export class ExpensesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private collection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('expenses');
  }

  private clean(data: any) {
    const out = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) (out as any)[key] = val;
    }
    return out;
  }

  async create(holderId: string, dto: CreateExpenseDto) {
    const col = this.collection(holderId);
    const data = this.clean({
      ...dto,
      currency: dto.currency ?? 'EUR',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ref = await col.add(data);
    const snap = await ref.get();

    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const snap = await this.collection(holderId).get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
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
}
