import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertiesDto } from './dto/search-property.dto';

@Injectable()
export class PropertiesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private propertiesCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('properties');
  }

  private cleanData<T extends Record<string, any>>(data: T): T {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleaned[k] = v;
    }
    return cleaned;
  }

  async create(holderId: string, dto: CreatePropertyDto) {
    const col = this.propertiesCollection(holderId);
    const raw = {
      ...dto,
      isPublished: dto.isPublished ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const data = this.cleanData(raw);
    const ref = await col.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const col = this.propertiesCollection(holderId);
    const snap = await col.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, propertyId: string) {
    const col = this.propertiesCollection(holderId);
    const doc = await col.doc(propertyId).get();
    if (!doc.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, propertyId: string, dto: UpdatePropertyDto) {
    const col = this.propertiesCollection(holderId);
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
    const col = this.propertiesCollection(holderId);
    const ref = col.doc(propertyId);
    const doc = await ref.get();
    if (!doc.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }
    await ref.delete();
    return { success: true };
  }

  /**
   * Ricerca "globale" per TENANT:
   * usa una collectionGroup sulle subcollection 'properties'
   * di tutti gli holders.
   */
  async searchPublic(query: SearchPropertiesDto) {
  const db = this.firebaseService.firestore;

  let q: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> =
    db.collectionGroup('properties').where('isPublished', '==', true);

  if (query.city) {
    q = q.where('city', '==', query.city);
  }

  if (query.operationType) {
    q = q.where('operationType', '==', query.operationType);
  }

  try {
   
    const snap = await q.get();

    let results = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    // Filtri min/max price lato server
    const minPrice = query.minPrice ? Number(query.minPrice) : undefined;
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : undefined;

    if (minPrice !== undefined) {
      results = results.filter((p) => p.price >= minPrice);
    }
    if (maxPrice !== undefined) {
      results = results.filter((p) => p.price <= maxPrice);
    }

    return results;
  } catch (err: any) {
 
    console.error(
      'Errore Firestore in searchPublic (probabile indice mancante):',
      err?.message ?? err,
    );

    // Ritorna lista vuota invece di errore 500
    return [];
  }
}

}
