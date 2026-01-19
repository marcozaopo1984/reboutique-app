import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertiesDto } from './dto/search-property.dto';
import { CreatePropertyFileDto } from './dto/create-property-file.dto';
import * as admin from 'firebase-admin';

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

  // -------------------------
  // CRUD
  // -------------------------

  async create(holderId: string, dto: CreatePropertyDto) {
    const col = this.collection(holderId);

    const rawData = {
      ...dto,
      isPublished: dto.isPublished ?? false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const data = this.cleanData(rawData as any);

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

  async update(holderId: string, propertyId: string, dto: UpdatePropertyDto) {
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

    const updateData = this.cleanData(rawUpdate as any);

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

    // (opzionale) potresti anche cancellare i files associati qui,
    // ma per ora lasciamo semplice: cancelli la property e basta.
    await ref.delete();
    return { success: true };
  }

  // -------------------------
  // FILES (documenti)
  // -------------------------

  private filesCollection(holderId: string, propertyId: string) {
    return this.collection(holderId).doc(propertyId).collection('files');
  }

  async addFile(holderId: string, propertyId: string, dto: CreatePropertyFileDto) {
    // verifica property esiste
    const propRef = this.collection(holderId).doc(propertyId);
    const propSnap = await propRef.get();
    if (!propSnap.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const col = this.filesCollection(holderId, propertyId);

    const data = this.cleanData({
      ...dto,
      createdAt: new Date(),
    } as any);

    const ref = await col.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, propertyId: string) {
    // verifica property esiste
    const propRef = this.collection(holderId).doc(propertyId);
    const propSnap = await propRef.get();
    if (!propSnap.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const col = this.filesCollection(holderId, propertyId);
    const snap = await col.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async removeFile(holderId: string, propertyId: string, fileId: string) {
    // verifica property esiste
    const propRef = this.collection(holderId).doc(propertyId);
    const propSnap = await propRef.get();
    if (!propSnap.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const col = this.filesCollection(holderId, propertyId);
    const ref = col.doc(fileId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException(`File ${fileId} not found`);
    }

    const data = doc.data() as any;
    const storagePath: string | undefined = data?.storagePath ?? data?.path;

    // delete fisico storage
    if (storagePath) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storagePath).delete({ ignoreNotFound: true });
      } catch (err) {
        console.error(
          'Errore delete Storage file:',
          storagePath,
          (err as any)?.message ?? err,
        );
      }
    }

    // delete metadata firestore
    await ref.delete();
    return { success: true };
  }

  // -------------------------
  // SEARCH PUBLIC (collectionGroup)
  // -------------------------

  async searchPublic(query: SearchPropertiesDto) {
    const db = this.firebaseService.firestore;

    // Prendo tutte le properties pubblicate da tutti gli holders
    let q: FirebaseFirestore.Query = db
      .collectionGroup('properties')
      .where('isPublished', '==', true);

    // Per ora i filtri Firestore "rigidi" li mettiamo solo su type,
    // il resto lo filtriamo in memoria.
    if ((query as any).operationType) {
      q = q.where('type', '==', (query as any).operationType);
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
    if ((query as any).minPrice !== undefined) {
      results = results.filter(
        (p) =>
          typeof (p as any).baseMonthlyRent === 'number' &&
          (p as any).baseMonthlyRent >= (query as any).minPrice,
      );
    }

    if ((query as any).maxPrice !== undefined) {
      results = results.filter(
        (p) =>
          typeof (p as any).baseMonthlyRent === 'number' &&
          (p as any).baseMonthlyRent <= (query as any).maxPrice,
      );
    }

    if ((query as any).query) {
      const qLower = String((query as any).query).toLowerCase();
      results = results.filter((p) => {
        const name = String((p as any).name ?? '').toLowerCase();
        const address = String((p as any).address ?? '').toLowerCase();
        const code = String((p as any).code ?? '').toLowerCase();
        return name.includes(qLower) || address.includes(qLower) || code.includes(qLower);
      });
    }

    return results;
  }
}
