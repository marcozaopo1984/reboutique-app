import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';

@Injectable()
export class PaymentsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private collection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('payments');
  }

  private clean<T extends Record<string, any>>(data: T): T {
    const out: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) out[key] = val;
    }
    return out;
  }

  async create(holderId: string, dto: CreatePaymentDto) {
    const col = this.collection(holderId);

    const data = this.clean({
      ...dto,
      status: dto.status ?? 'PLANNED',
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

  async update(holderId: string, paymentId: string, dto: UpdatePaymentDto) {
    const ref = this.collection(holderId).doc(paymentId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Payment ${paymentId} not found`);

    const data = this.clean({
      ...dto,
      updatedAt: new Date(),
    });

    await ref.set(data, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...(updated.data() as any) };
  }

  async remove(holderId: string, paymentId: string) {
    const ref = this.collection(holderId).doc(paymentId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Payment ${paymentId} not found`);

    await ref.delete();
    return { success: true };
  }
}
