import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { UpdateLandlordDto } from './dto/update-landlord.dto';
import { CreateLandlordFileDto } from './dto/create-landlord-file.dto';
import * as admin from 'firebase-admin';

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

  // -------------------------
  // CRUD
  // -------------------------

  async create(holderId: string, dto: CreateLandlordDto) {
    const data = this.cleanData({
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const ref = await this.landlordsCollection(holderId).add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const snap = await this.landlordsCollection(holderId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, landlordId: string) {
    const doc = await this.landlordsCollection(holderId).doc(landlordId).get();
    if (!doc.exists) throw new NotFoundException(`Landlord ${landlordId} not found`);
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, landlordId: string, dto: UpdateLandlordDto) {
    const ref = this.landlordsCollection(holderId).doc(landlordId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Landlord ${landlordId} not found`);

    const updateData = this.cleanData({
      ...dto,
      updatedAt: new Date(),
    } as any);

    await ref.set(updateData, { merge: true });
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async remove(holderId: string, landlordId: string) {
    const ref = this.landlordsCollection(holderId).doc(landlordId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Landlord ${landlordId} not found`);

    await ref.delete();
    return { success: true };
  }

  // -------------------------
  // FILES (documenti)
  // -------------------------

  private filesCollection(holderId: string, landlordId: string) {
    return this.landlordsCollection(holderId).doc(landlordId).collection('files');
  }

  async addFile(holderId: string, landlordId: string, dto: CreateLandlordFileDto) {
    // verifica landlord esiste
    const landlordRef = this.landlordsCollection(holderId).doc(landlordId);
    const landlordSnap = await landlordRef.get();
    if (!landlordSnap.exists) throw new NotFoundException(`Landlord ${landlordId} not found`);

    const filesCol = this.filesCollection(holderId, landlordId);

    const data = this.cleanData({
      ...dto,
      createdAt: new Date(),
    } as any);

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, landlordId: string) {
    // verifica landlord esiste
    const landlordRef = this.landlordsCollection(holderId).doc(landlordId);
    const landlordSnap = await landlordRef.get();
    if (!landlordSnap.exists) throw new NotFoundException(`Landlord ${landlordId} not found`);

    const filesCol = this.filesCollection(holderId, landlordId);
    const snap = await filesCol.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async removeFile(holderId: string, landlordId: string, fileId: string) {
    // verifica landlord esiste
    const landlordRef = this.landlordsCollection(holderId).doc(landlordId);
    const landlordSnap = await landlordRef.get();
    if (!landlordSnap.exists) throw new NotFoundException(`Landlord ${landlordId} not found`);

    const filesCol = this.filesCollection(holderId, landlordId);
    const ref = filesCol.doc(fileId);
    const doc = await ref.get();

    if (!doc.exists) throw new NotFoundException(`File ${fileId} not found`);

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
}
