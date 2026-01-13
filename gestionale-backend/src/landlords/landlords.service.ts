import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { UpdateLandlordDto } from './dto/update-landlord.dto';

@Injectable()
export class LandlordsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private cleanData<T extends Record<string, any>>(data: T): T {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleaned[k] = v;
    }
    return cleaned;
  }

  private landlordsCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('landlords');
  }

  async create(holderId: string, dto: CreateLandlordDto) {
    const data = this.cleanData({
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ref = await this.landlordsCollection(holderId).add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const snap = await this.landlordsCollection(holderId).get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, landlordId: string) {
    const doc = await this.landlordsCollection(holderId).doc(landlordId).get();
    if (!doc.exists) {
      throw new NotFoundException(`Landlord ${landlordId} not found`);
    }
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, landlordId: string, dto: UpdateLandlordDto) {
    const ref = this.landlordsCollection(holderId).doc(landlordId);
    const doc = await ref.get();
    if (!doc.exists) {
      throw new NotFoundException(`Landlord ${landlordId} not found`);
    }

    const updateData = this.cleanData({
      ...dto,
      updatedAt: new Date(),
    });

    await ref.set(updateData, { merge: true });
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async remove(holderId: string, landlordId: string) {
    const ref = this.landlordsCollection(holderId).doc(landlordId);
    const doc = await ref.get();
    if (!doc.exists) {
      throw new NotFoundException(`Landlord ${landlordId} not found`);
    }

    await ref.delete();
    return { success: true };
  }
}
