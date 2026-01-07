import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';

@Injectable()
export class LeasesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private collection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('leases');
  }

  private clean<T extends Record<string, any>>(data: T): T {
    const out: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) out[key] = val;
    }
    return out;
  }

  async create(holderId: string, dto: CreateLeaseDto) {
    const col = this.collection(holderId);

    const data = this.clean({
      ...dto,
      status: dto.status ?? 'ACTIVE',
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

  async findOne(holderId: string, leaseId: string) {
    const doc = await this.collection(holderId).doc(leaseId).get();
    if (!doc.exists) throw new NotFoundException(`Lease ${leaseId} not found`);
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, leaseId: string, dto: UpdateLeaseDto) {
    const ref = this.collection(holderId).doc(leaseId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const data = this.clean({
      ...dto,
      updatedAt: new Date(),
    });

    await ref.set(data, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...(updated.data() as any) };
  }

  async remove(holderId: string, leaseId: string) {
    const ref = this.collection(holderId).doc(leaseId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    await ref.delete();
    return { success: true };
  }
}
