// src/tenants/tenants.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { LeaseType } from '../leases/dto/create-lease.dto';
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

  private leasesCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('leases');
  }

  private parseAnyDateLike(value: any): Date | undefined {
    if (value === null || value === undefined) return undefined;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return undefined;

      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(`${s}T00:00:00.000Z`);
        return Number.isNaN(d.getTime()) ? undefined : d;
      }

      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }

    if (typeof value === 'object' && typeof value.toDate === 'function') {
      const d = value.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      return undefined;
    }

    if (typeof value === 'object' && typeof value._seconds === 'number') {
      const d = new Date(value._seconds * 1000);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }

    return undefined;
  }

  private dayValueUtc(date: Date): number {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  }

  private computeTenantStatusFromLease(lease: any): 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING' {
    const bookingDate = this.parseAnyDateLike(lease?.bookingDate);
    const startDate = this.parseAnyDateLike(lease?.startDate);
    const endDate = this.parseAnyDateLike(lease?.endDate);
    const today = new Date();
    const todayValue = this.dayValueUtc(today);

    if (!bookingDate || !startDate) return 'PENDING';

    const bookingValue = this.dayValueUtc(bookingDate);
    const startValue = this.dayValueUtc(startDate);

    if (todayValue < bookingValue) return 'PENDING';
    if (todayValue < startValue) return 'INCOMING';

    if (!endDate) return 'CURRENT';

    const endValue = this.dayValueUtc(endDate);
    if (todayValue <= endValue) return 'CURRENT';
    return 'PAST';
  }

  private pickLatestTenantLeaseByBookingDate(leases: any[]): any | undefined {
    let latest: any | undefined;
    let latestBookingValue = Number.NEGATIVE_INFINITY;

    for (const lease of leases) {
      if (lease?.type !== LeaseType.TENANT || !lease?.tenantId) continue;

      const bookingDate = this.parseAnyDateLike(lease.bookingDate);
      const bookingValue = bookingDate ? this.dayValueUtc(bookingDate) : Number.NEGATIVE_INFINITY;
      if (bookingValue > latestBookingValue) {
        latest = lease;
        latestBookingValue = bookingValue;
      }
    }

    return latest;
  }

  private buildTenantStatusMap(leases: any[]): Map<string, 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING'> {
    const latestLeaseByTenantId = new Map<string, any>();
    const latestBookingValueByTenantId = new Map<string, number>();

    for (const lease of leases) {
      if (lease?.type !== LeaseType.TENANT || !lease?.tenantId) continue;

      const bookingDate = this.parseAnyDateLike(lease.bookingDate);
      const bookingValue = bookingDate ? this.dayValueUtc(bookingDate) : Number.NEGATIVE_INFINITY;
      const currentValue = latestBookingValueByTenantId.get(lease.tenantId) ?? Number.NEGATIVE_INFINITY;

      if (bookingValue > currentValue) {
        latestBookingValueByTenantId.set(lease.tenantId, bookingValue);
        latestLeaseByTenantId.set(lease.tenantId, lease);
      }
    }

    const statusMap = new Map<string, 'CURRENT' | 'INCOMING' | 'PAST' | 'PENDING'>();
    for (const [tenantId, lease] of latestLeaseByTenantId.entries()) {
      statusMap.set(tenantId, this.computeTenantStatusFromLease(lease));
    }

    return statusMap;
  }

  /**
   * Utility: rimuove ricorsivamente i campi undefined dall'oggetto,
   * perché Firestore admin non li accetta.
   */
  private cleanData<T>(value: T): T {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.cleanData(item))
        .filter((item) => item !== undefined) as T;
    }

    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const cleaned: Record<string, any> = {};
      for (const [key, val] of Object.entries(value as Record<string, any>)) {
        if (val !== undefined) {
          cleaned[key] = this.cleanData(val);
        }
      }
      return cleaned as T;
    }

    return value;
  }

  async create(holderId: string, dto: CreateTenantDto) {
    const col = this.tenantsCollection(holderId);

    const rawData = {
      ...dto,
      holderId,
      status: 'PENDING',
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
    const [tenantsSnap, leasesSnap] = await Promise.all([
      col.get(),
      this.leasesCollection(holderId).get(),
    ]);

    const statusMap = this.buildTenantStatusMap(leasesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));

    return tenantsSnap.docs.map((d) => {
      const tenant = { id: d.id, ...(d.data() as any) };
      return {
        ...tenant,
        status: statusMap.get(d.id) ?? 'PENDING',
      };
    });
  }

  async findOne(holderId: string, tenantId: string) {
    const col = this.tenantsCollection(holderId);
    const doc = await col.doc(tenantId).get();

    if (!doc.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const leasesSnap = await this.leasesCollection(holderId).where('tenantId', '==', tenantId).get();
    const latestLease = this.pickLatestTenantLeaseByBookingDate(
      leasesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })),
    );

    return {
      id: doc.id,
      ...(doc.data() as any),
      status: latestLease ? this.computeTenantStatusFromLease(latestLease) : 'PENDING',
    };
  }

  async update(holderId: string, tenantId: string, dto: UpdateTenantDto) {
    const col = this.tenantsCollection(holderId);
    const ref = col.doc(tenantId);
    const doc = await ref.get();

    if (!doc.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const { status: _ignoredStatus, ...restDto } = dto as any;

    const rawUpdate = {
      ...restDto,
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
    return this.tenantsCollection(holderId).doc(tenantId).collection('files');
  }

  async addFile(holderId: string, tenantId: string, dto: CreateTenantFileDto) {
    const tenantRef = this.tenantsCollection(holderId).doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

    const filesCol = this.tenantFilesCollection(holderId, tenantId);
    const storagePath = dto.storagePath ?? dto.path;

    const rawData = {
      ...dto,
      storagePath,
      createdAt: new Date(),
    };

    const data = this.cleanData(rawData);

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, tenantId: string) {
    const tenantRef = this.tenantsCollection(holderId).doc(tenantId);
    const tenantSnap = await tenantRef.get();

    if (!tenantSnap.exists) {
      throw new NotFoundException(`Tenant ${tenantId} not found`);
    }

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

    let storagePath: string | undefined = data?.storagePath ?? data?.path;
    const fileName: string | undefined = data?.fileName;

    console.log('removeFile - raw data from Firestore:', data);

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
