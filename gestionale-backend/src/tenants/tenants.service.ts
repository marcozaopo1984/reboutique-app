// --- in testa al file ---
import * as admin from 'firebase-admin';
import { Injectable, NotFoundException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { CreateTenantFileDto } from './dto/create-tenant-file.dto';

@Injectable()
export class TenantsService {
  private collectionName = 'tenants';
  constructor(private readonly firebaseService: FirebaseService) {}

  private get tenants() {
    return this.firebaseService.firestore.collection(this.collectionName);
  }


  private filesCollection(tenantId: string) {

    return this.tenants.doc(tenantId).collection('files');
  }

  async addFile(tenantId: string, dto: CreateTenantFileDto) {

    const tenantDoc = await this.tenants.doc(tenantId).get();
    if (!tenantDoc.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const data = { ...dto, uploadedAt: new Date() };

    console.log('[addFile] write to: tenants/%s/files  storagePath=%s  fileName=%s',
      tenantId, dto.storagePath, dto.fileName);


    const ref = await this.filesCollection(tenantId).add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(tenantId: string) {
    console.log('[listFiles] read: tenants/%s/files', tenantId);
    const snap = await this.filesCollection(tenantId).get();
    console.log('[listFiles] count=%d', snap.size);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  }

  async removeFile(tenantId: string, fileId: string): Promise<void> {
    console.log('[removeFile] tenants/%s/files/%s', tenantId, fileId);
    const ref = this.filesCollection(tenantId).doc(fileId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(
      `File with id ${fileId} for tenant ${tenantId} not found`
    );

    const storagePath = (snap.data() as any)?.storagePath;
    if (storagePath) {
      try { await admin.storage().bucket().file(storagePath).delete(); } catch {}
    }
    await ref.delete();
  }

 
  async create(dto: CreateTenantDto) {
    const data = { ...dto};
    const ref = await this.tenants.add(data);
    const doc = await ref.get();
    return { id: doc.id, ...(doc.data() as any) };
  }

  async findAll() {
    const snap = await this.tenants.get();
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(id: string) {
    const doc = await this.tenants.doc(id).get();
    if (!doc.exists) throw new NotFoundException(`Tenant ${id} not found`);
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(id: string, dto: UpdateTenantDto) {
    const ref = this.tenants.doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Tenant ${id} not found`);

    const updateData = Object.fromEntries(
      Object.entries(dto).filter(([, v]) => v !== undefined)
    );
    await ref.set(updateData as FirebaseFirestore.DocumentData, { merge: true });
    const upd = await ref.get();
    return { id: upd.id, ...(upd.data() as any) };
  }

  async remove(id: string) {
    const ref = this.tenants.doc(id);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Tenant ${id} not found`);
    await ref.delete();
  }
}
