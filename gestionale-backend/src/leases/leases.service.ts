import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateLeaseDto, LeaseType } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import * as admin from 'firebase-admin';
import { CreateLeaseFileDto } from './dto/create-lease-file.dto';

type LeaseDoc = {
  type: LeaseType;
  propertyId: string;
  tenantId?: string;
  landlordId?: string;

  startDate: Date;
  endDate?: Date;
  nextPaymentDue?: Date;

  externalId?: string;

  monthlyRentWithoutBills: number;
  monthlyRentWithBills?: number;
  billsIncludedAmount?: number;

  depositAmount?: number;
  adminFeeAmount?: number;
  otherFeesAmount?: number;

  dueDayOfMonth?: number;

  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class LeasesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private cleanData<T extends Record<string, any>>(data: T): T {
    const cleaned: any = {};
    for (const [k, v] of Object.entries(data)) {
      if (v !== undefined) cleaned[k] = v;
    }
    return cleaned;
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
  }

  /**
   * ✅ Converte in Date gestendo Firestore Timestamp (admin SDK) e string
   */
  private toJsDate(v: any): Date {
    if (!v) return new Date(NaN);

    // Firestore Timestamp (admin): ha toDate()
    if (typeof v?.toDate === 'function') return v.toDate();

    // già Date
    if (v instanceof Date) return v;

    // string / number
    return new Date(v);
  }

  private leasesCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('leases');
  }

  private paymentsCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('payments');
  }

  private expensesCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('expenses');
  }

  private propertiesDoc(holderId: string, propertyId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('properties')
      .doc(propertyId);
  }

  private tenantsDoc(holderId: string, tenantId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('tenants')
      .doc(tenantId);
  }

  private landlordsDoc(holderId: string, landlordId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('landlords')
      .doc(landlordId);
  }

  private leaseFilesCollection(holderId: string, leaseId: string) {
    return this.leasesCollection(holderId).doc(leaseId).collection('files');
  }

  async addFile(holderId: string, leaseId: string, dto: CreateLeaseFileDto) {
    const leaseRef = this.leasesCollection(holderId).doc(leaseId);
    const leaseSnap = await leaseRef.get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const filesCol = this.leaseFilesCollection(holderId, leaseId);

    const data = {
      ...dto,
      createdAt: new Date(),
    };

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, leaseId: string) {
    const filesCol = this.leaseFilesCollection(holderId, leaseId);
    const snap = await filesCol.get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async removeFile(holderId: string, leaseId: string, fileId: string) {
    const filesCol = this.leaseFilesCollection(holderId, leaseId);
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
        console.error('Errore delete Storage file:', storagePath, (err as any)?.message ?? err);
      }
    }

    // delete metadata firestore
    await ref.delete();
    return { success: true };
  }

  // ---- CRUD leases ----

  async create(holderId: string, dto: CreateLeaseDto) {
    // 1) property must exist
    const propSnap = await this.propertiesDoc(holderId, dto.propertyId).get();
    if (!propSnap.exists) {
      throw new NotFoundException(`Property ${dto.propertyId} not found`);
    }
    const propData = propSnap.data() as any;

    // 2) type-specific checks
    if (dto.type === LeaseType.TENANT) {
      if (!dto.tenantId) {
        throw new BadRequestException('tenantId is required for TENANT lease');
      }
      const tenantSnap = await this.tenantsDoc(holderId, dto.tenantId).get();
      if (!tenantSnap.exists) throw new NotFoundException(`Tenant ${dto.tenantId} not found`);

      // optional sanity check: if gross & bills present, net should match
      if (dto.monthlyRentWithBills !== undefined && dto.billsIncludedAmount !== undefined) {
        const net = dto.monthlyRentWithBills - dto.billsIncludedAmount;
        const diff = Math.abs(net - dto.monthlyRentWithoutBills);
        if (diff > 0.01) {
          throw new BadRequestException(
            `monthlyRentWithoutBills should equal monthlyRentWithBills - billsIncludedAmount (expected ${net})`,
          );
        }
      }
    }

    if (dto.type === LeaseType.LANDLORD) {
      if (!dto.landlordId) {
        throw new BadRequestException('landlordId is required for LANDLORD lease');
      }
      const landlordSnap = await this.landlordsDoc(holderId, dto.landlordId).get();
      if (!landlordSnap.exists) throw new NotFoundException(`Landlord ${dto.landlordId} not found`);

      // optional: ensure property has same landlord if present
      if (propData?.landlordId && propData.landlordId !== dto.landlordId) {
        throw new BadRequestException(
          `Lease landlordId (${dto.landlordId}) does not match property.landlordId (${propData.landlordId})`,
        );
      }
    }

    const data: LeaseDoc = this.cleanData({
      type: dto.type,
      propertyId: dto.propertyId,
      tenantId: dto.tenantId,
      landlordId: dto.landlordId,

      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      nextPaymentDue: dto.nextPaymentDue ? new Date(dto.nextPaymentDue) : undefined,

      externalId: dto.externalId,

      monthlyRentWithoutBills: dto.monthlyRentWithoutBills,
      monthlyRentWithBills: dto.monthlyRentWithBills,
      billsIncludedAmount: dto.billsIncludedAmount,

      depositAmount: dto.depositAmount,
      adminFeeAmount: dto.adminFeeAmount,
      otherFeesAmount: dto.otherFeesAmount,

      dueDayOfMonth: dto.dueDayOfMonth,

      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);

    const ref = await this.leasesCollection(holderId).add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const snap = await this.leasesCollection(holderId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async findOne(holderId: string, leaseId: string) {
    const doc = await this.leasesCollection(holderId).doc(leaseId).get();
    if (!doc.exists) throw new NotFoundException(`Lease ${leaseId} not found`);
    return { id: doc.id, ...(doc.data() as any) };
  }

  async update(holderId: string, leaseId: string, dto: UpdateLeaseDto) {
    const ref = this.leasesCollection(holderId).doc(leaseId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const updateData = this.cleanData({
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      nextPaymentDue: dto.nextPaymentDue ? new Date(dto.nextPaymentDue) : undefined,
      updatedAt: new Date(),
    } as any);

    await ref.set(updateData, { merge: true });
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async remove(holderId: string, leaseId: string) {
    const ref = this.leasesCollection(holderId).doc(leaseId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    // NB: qui non cancelliamo in cascata payments/expenses/files.
    // Se vuoi anche quello, dimmelo e te lo aggiungo (batch delete + storage delete).
    await ref.delete();
    return { success: true };
  }

  // ---- Schedule generation ----

  private monthKey(d: Date): string {
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    return `${y}-${String(m).padStart(2, '0')}`;
  }

  private addMonthsUTC(d: Date, months: number): Date {
    const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    nd.setUTCMonth(nd.getUTCMonth() + months);
    return nd;
  }

  private computeDueDateForMonth(base: Date, dueDayOfMonth: number): Date {
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    const day = Math.max(1, Math.min(28, dueDayOfMonth));
    return new Date(Date.UTC(y, m, day));
  }

  /**
   * Genera righe mensili:
   * - TENANT => payments (holders/{holderId}/payments)
   * - LANDLORD => expenses (holders/{holderId}/expenses)
   *
   * Regola:
   * - se nextPaymentDue esiste: quella è la prima dueDate, poi +1 mese mantenendo il giorno (clamp 28)
   * - altrimenti usa dueDayOfMonth (default 5)
   *
   * Genera fino a endDate (se presente) altrimenti per N mesi (default 12).
   */
  async generateSchedule(holderId: string, leaseId: string, monthsIfNoEnd = 12) {
    const leaseSnap = await this.leasesCollection(holderId).doc(leaseId).get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const lease = leaseSnap.data() as any;

    const type: LeaseType = lease.type;
    const propertyId: string = lease.propertyId;
    if (!propertyId) throw new BadRequestException('lease.propertyId missing');

    // property => buildingId
    const propSnap = await this.propertiesDoc(holderId, propertyId).get();
    if (!propSnap.exists) throw new NotFoundException(`Property ${propertyId} not found`);
    const buildingId = (propSnap.data() as any)?.buildingId ?? undefined;

    const tenantId: string | undefined = lease.tenantId;
    const landlordId: string | undefined = lease.landlordId;

    // ✅ Timestamp-safe
    const startDate = this.toJsDate(lease.startDate);
    const endDate: Date | undefined = lease.endDate ? this.toJsDate(lease.endDate) : undefined;
    const firstDue: Date | undefined = lease.nextPaymentDue ? this.toJsDate(lease.nextPaymentDue) : undefined;

    if (Number.isNaN(startDate.getTime())) {
      throw new BadRequestException('lease.startDate invalid or missing');
    }

    const dueDayOfMonth: number = lease.dueDayOfMonth ?? 5;
    const amountNet: number = Number(lease.monthlyRentWithoutBills);

    if (Number.isNaN(amountNet)) {
      throw new BadRequestException('lease.monthlyRentWithoutBills invalid');
    }

    if (type === LeaseType.TENANT) {
      if (!tenantId) throw new BadRequestException('TENANT lease missing tenantId');
    } else {
      if (!landlordId) throw new BadRequestException('LANDLORD lease missing landlordId');
    }

    // range mensile
    const startMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const maxEnd = endDate
      ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))
      : this.addMonthsUTC(startMonth, monthsIfNoEnd - 1);

    // prima scadenza
    let dueCursor: Date | undefined = firstDue
      ? new Date(
          Date.UTC(
            firstDue.getUTCFullYear(),
            firstDue.getUTCMonth(),
            Math.min(28, firstDue.getUTCDate()),
          ),
        )
      : undefined;

    const batch = this.firebaseService.firestore.batch();
    let writes = 0;

    let cursor = startMonth;
    while (cursor.getTime() <= maxEnd.getTime()) {
      const period = this.monthKey(cursor);

      // calcolo dueDate (Date)
      let dueDate: Date;
      if (dueCursor) {
        while (
          dueCursor.getUTCFullYear() < cursor.getUTCFullYear() ||
          (dueCursor.getUTCFullYear() === cursor.getUTCFullYear() &&
            dueCursor.getUTCMonth() < cursor.getUTCMonth())
        ) {
          dueCursor = this.addMonthsUTC(dueCursor, 1);
          dueCursor = new Date(
            Date.UTC(
              dueCursor.getUTCFullYear(),
              dueCursor.getUTCMonth(),
              Math.min(28, dueCursor.getUTCDate()),
            ),
          );
        }

        if (
          dueCursor.getUTCFullYear() === cursor.getUTCFullYear() &&
          dueCursor.getUTCMonth() === cursor.getUTCMonth()
        ) {
          dueDate = dueCursor;

          // prepara successiva
          const next = this.addMonthsUTC(dueCursor, 1);
          dueCursor = new Date(
            Date.UTC(
              next.getUTCFullYear(),
              next.getUTCMonth(),
              Math.min(28, dueDate.getUTCDate()),
            ),
          );
        } else {
          dueDate = this.computeDueDateForMonth(cursor, dueDayOfMonth);
        }
      } else {
        dueDate = this.computeDueDateForMonth(cursor, dueDayOfMonth);
      }

      const dueISO = this.isoDate(dueDate);

      if (type === LeaseType.TENANT) {
        // amount: se c’è monthlyRentWithBills usa quello, altrimenti net (+ bills se presente)
        const gross = lease.monthlyRentWithBills;
        const bills = lease.billsIncludedAmount;
        const amount =
          gross !== undefined
            ? Number(gross)
            : bills !== undefined
              ? Number(amountNet) + Number(bills)
              : Number(amountNet);

        const ref = this.paymentsCollection(holderId).doc();

        batch.set(
          ref,
          this.cleanData({
            leaseId,
            tenantId,
            propertyId,
            buildingId: buildingId ?? undefined,

            // ✅ coerente con CreatePaymentDto/UI
            dueDate: dueISO, // "YYYY-MM-DD"
            paidDate: undefined,

            amount,
            currency: 'EUR',

            kind: 'RENT',
            status: 'PLANNED',

            notes: `Auto-generated schedule (${period})`,

            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );

        writes++;
      } else {
        const ref = this.expensesCollection(holderId).doc();

        batch.set(
          ref,
          this.cleanData({
            leaseId,
            propertyId,
            landlordId,

            // ✅ coerente con CreateExpenseDto/UI
            costDate: dueISO,
            costMonth: period,

            amount: Number(amountNet),
            currency: 'EUR',

            type: 'RENT_TO_LANDLORD',
            frequency: 'MONTHLY',

            scope: 'UNIT',
            allocationMode: 'NONE',

            status: 'PLANNED',
            paidDate: undefined,

            notes: `Auto-generated schedule (${period})`,

            createdAt: new Date(),
            updatedAt: new Date(),
          }),
        );

        writes++;
      }

      cursor = this.addMonthsUTC(cursor, 1);
    }

    await batch.commit();
    return { success: true, generated: writes };
  }
}
