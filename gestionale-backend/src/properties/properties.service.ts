import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertiesDto } from './dto/search-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private collection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('properties');
  }

  /**
   * Rimuove i campi undefined, perché Firestore non li accetta.
   */
  private cleanData<T extends Record<string, any>>(data: T): T {
    const cleaned: any = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        cleaned[key] = value;
      }
    }
    return cleaned;
  }

  async create(holderId: string, dto: CreatePropertyDto) {
    const col = this.collection(holderId);

    const rawData = {
      ...dto,
      isPublished: dto.isPublished ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const data = this.cleanData(rawData);

    const ref = await col.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const col = this.collection(holderId);
    const snap = await col.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, propertyId: string) {
    const col = this.collection(holderId);
    const doc = await col.doc(propertyId).get();

    if (!doc.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(
    holderId: string,
    propertyId: string,
    dto: UpdatePropertyDto,
  ) {
    const col = this.collection(holderId);
    const ref = col.doc(propertyId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const rawUpdate = {
      ...dto,
      updatedAt: new Date(),
    };

    const updateData = this.cleanData(rawUpdate);

    await ref.set(updateData, { merge: true });
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async remove(holderId: string, propertyId: string) {
    const col = this.collection(holderId);
    const ref = col.doc(propertyId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    await ref.delete();
    return { success: true };
  }
  
  async searchPublic(query: SearchPropertiesDto) {
  const db = this.firebaseService.firestore;

  // Prendo tutte le properties pubblicate da tutti gli holders
  let q: FirebaseFirestore.Query = db
    .collectionGroup('properties')
    .where('isPublished', '==', true);

  // Per ora i filtri Firestore "rigidi" li mettiamo solo su type,
  // il resto lo filtriamo in memoria.
  if (query.operationType) {
    q = q.where('type', '==', query.operationType);
  }

  const snap = await q.get();

  let results = snap.docs.map((d) => {
    const data = d.data() as any;
    return {
      id: d.id,
      ...data,
    };
  });

  // Filtri in memoria per min/max rent e query testuale
  if (query.minPrice !== undefined) {
    results = results.filter(
      (p) =>
        typeof p.baseMonthlyRent === 'number' &&
        p.baseMonthlyRent >= query.minPrice!,
    );
  }

  if (query.maxPrice !== undefined) {
    results = results.filter(
      (p) =>
        typeof p.baseMonthlyRent === 'number' &&
        p.baseMonthlyRent <= query.maxPrice!,
    );
  }

  if (query.query) {
    const qLower = query.query.toLowerCase();
    results = results.filter((p) => {
      const name = (p.name ?? '').toLowerCase();
      const address = (p.address ?? '').toLowerCase();
      const code = (p.code ?? '').toLowerCase();
      return (
        name.includes(qLower) ||
        address.includes(qLower) ||
        code.includes(qLower)
      );
    });
  }

  return results;
}
}
