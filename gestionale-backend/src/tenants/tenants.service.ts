// src/tenants/tenants.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantFileDto } from './dto/create-tenant-file.dto';
import * as admin from 'firebase-admin';


@Injectable()
export class TenantsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  /**
   * Collezione tenants per uno specifico holder:
   * holders/{holderId}/tenants
   */
  private tenantsCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('tenants');
  }

  /**
   * Utility: rimuove i campi undefined dall'oggetto,
   * perché Firestore admin non li accetta.
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

  async create(holderId: string, dto: CreateTenantDto) {
    const col = this.tenantsCollection(holderId);

    const rawData = {
      ...dto,
      holderId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const data = this.cleanData(rawData);

    const ref = await col.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const col = this.tenantsCollection(holderId);
    const snap = await col.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, tenantId: string) {
    const col = this.tenantsCollection(holderId);
    const doc = await col.doc(tenantId).get();
    if (!doc.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, tenantId: string, dto: UpdateTenantDto) {
    const col = this.tenantsCollection(holderId);
    const ref = col.doc(tenantId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
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

  async remove(holderId: string, tenantId: string) {
    const col = this.tenantsCollection(holderId);
    const ref = col.doc(tenantId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    await ref.delete();
    return { success: true };
  }

   private tenantFilesCollection(holderId: string, tenantId: string) {
    return this.tenantsCollection(holderId)
      .doc(tenantId)
      .collection('files');
  }
  
  async addFile(holderId: string, tenantId: string, dto: CreateTenantFileDto) {
    const filesCol = this.tenantFilesCollection(holderId, tenantId);

    const rawData = {
      ...dto,
      createdAt: new Date(),
    };

    const data = this.cleanData(rawData);

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, tenantId: string) {
    const filesCol = this.tenantFilesCollection(holderId, tenantId);
    const snap = await filesCol.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

async removeFile(holderId: string, tenantId: string, fileId: string) {
  const filesCol = this.tenantFilesCollection(holderId, tenantId);
  const ref = filesCol.doc(fileId);
  const doc = await ref.get();

  if (!doc.exists) {
    throw new NotFoundException(`File ${fileId} not found`);
  }

  const data = doc.data() as any;

  // 👇 QUI prendiamo il campo giusto dal documento
  let storagePath: string | undefined =
    data?.storagePath ?? data?.path; // fallback su "path" se in futuro cambi nome
  const fileName: string | undefined = data?.fileName;

  console.log('removeFile - raw data from Firestore:', data);

  // Se per caso storagePath non contiene il nome del file, lo aggiungo
  if (storagePath && fileName && !storagePath.endsWith(fileName)) {
    if (!storagePath.endsWith('/')) {
      storagePath += '/';
    }
    storagePath += fileName;
  }

  console.log('removeFile - computed storagePath:', storagePath);

  if (storagePath) {
    try {
      const bucketName =
        process.env.FIREBASE_STORAGE_BUCKET ||
        'reboutique-gestionale.firebasestorage.app';

      const bucket = admin.storage().bucket(bucketName);
      const file = bucket.file(storagePath);

      console.log(
        `removeFile - deleting from bucket "${bucketName}" path "${storagePath}"`,
      );

      await file.delete({ ignoreNotFound: true });

      console.log(`removeFile - Deleted storage file: ${storagePath}`);
    } catch (err) {
      console.error(
        `Errore nella cancellazione del file Storage ${storagePath}:`,
        (err as any)?.message ?? err,
      );
    }
  } else {
    console.warn(
      `removeFile - Nessun storagePath nel documento file ${fileId}, salto delete Storage`,
    );
  }

  await ref.delete();
  console.log(`removeFile - Deleted Firestore doc for fileId: ${fileId}`);

  return { success: true };
}


}
