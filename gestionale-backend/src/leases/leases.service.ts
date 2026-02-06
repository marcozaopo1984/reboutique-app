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

  bookingCostAmount?: number;
  bookingCostDate?: Date;

  registrationTaxAmount?: number;
  registrationTaxDate?: Date;

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

  // ---------------------------------------------------------
  // ✅ DATE PARSING ROBUSTO (string | Date | Firestore Timestamp)
  // ---------------------------------------------------------

  /**
   * Accetta:
   * - "YYYY-MM-DD" / ISO string
   * - Date
   * - Firestore Timestamp (admin.firestore.Timestamp) con toDate()
   * - oggetto compat {_seconds, _nanoseconds}
   */
  private parseAnyDateLike(value: any): Date | undefined {
    if (value === null || value === undefined) return undefined;

    // già Date
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }

    // stringa
    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return undefined;

      // se è "YYYY-MM-DD", lo interpreto in UTC per evitare shift timezone
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(s + 'T00:00:00.000Z');
        return Number.isNaN(d.getTime()) ? undefined : d;
      }

      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }

    // Firestore Timestamp con toDate()
    if (typeof value === 'object' && typeof value.toDate === 'function') {
      const d = value.toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
      return undefined;
    }

    // compat {_seconds}
    if (typeof value === 'object' && typeof value._seconds === 'number') {
      const d = new Date(value._seconds * 1000);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }

    return undefined;
  }

  private requireDate(value: any, fieldName: string): Date {
    const d = this.parseAnyDateLike(value);
    if (!d) throw new BadRequestException(`${fieldName} is missing or invalid`);
    return d;
  }

  private isoDate(d: Date): string {
    // d qui deve essere valida
    return d.toISOString().slice(0, 10);
  }

  // ---------------------------------------------------------
  // Firestore collections
  // ---------------------------------------------------------

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

  // -------------------------
  // FILES (leases)
  // -------------------------
  private leaseFilesCollection(holderId: string, leaseId: string) {
    return this.leasesCollection(holderId).doc(leaseId).collection('files');
  }

  async addFile(holderId: string, leaseId: string, dto: CreateLeaseFileDto) {
    const leaseRef = this.leasesCollection(holderId).doc(leaseId);
    const leaseSnap = await leaseRef.get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const filesCol = this.leaseFilesCollection(holderId, leaseId);
    const data = { ...dto, createdAt: new Date() };

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

    if (storagePath) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storagePath).delete({ ignoreNotFound: true });
      } catch (err) {
        console.error('Errore delete Storage file:', storagePath, (err as any)?.message ?? err);
      }
    }

    await ref.delete();
    return { success: true };
  }

  // -------------------------
  // CRUD leases
  // -------------------------

  async create(holderId: string, dto: CreateLeaseDto) {
    const propSnap = await this.propertiesDoc(holderId, dto.propertyId).get();
    if (!propSnap.exists) throw new NotFoundException(`Property ${dto.propertyId} not found`);
    const propData = propSnap.data() as any;

    if (dto.type === LeaseType.TENANT) {
      if (!dto.tenantId) throw new BadRequestException('tenantId is required for TENANT lease');
      const tenantSnap = await this.tenantsDoc(holderId, dto.tenantId).get();
      if (!tenantSnap.exists) throw new NotFoundException(`Tenant ${dto.tenantId} not found`);

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
      if (!dto.landlordId) throw new BadRequestException('landlordId is required for LANDLORD lease');
      const landlordSnap = await this.landlordsDoc(holderId, dto.landlordId).get();
      if (!landlordSnap.exists) throw new NotFoundException(`Landlord ${dto.landlordId} not found`);

      if (propData?.type && propData.type !== 'APARTMENT') {
        throw new BadRequestException('LANDLORD lease must be linked to a property of type APARTMENT');
      }
      if (propData?.landlordId && propData.landlordId !== dto.landlordId) {
        throw new BadRequestException(
          `Lease landlordId (${dto.landlordId}) does not match property.landlordId (${propData.landlordId})`,
        );
      }
    }

    // ✅ parse date robusto (accetta solo string valide)
    const startDate = this.requireDate(dto.startDate, 'startDate');
    const endDate = dto.endDate ? this.requireDate(dto.endDate, 'endDate') : undefined;
    const nextPaymentDue = dto.nextPaymentDue
      ? this.requireDate(dto.nextPaymentDue, 'nextPaymentDue')
      : undefined;

    const data: LeaseDoc = this.cleanData({
      type: dto.type,
      propertyId: dto.propertyId,
      tenantId: dto.tenantId,
      landlordId: dto.landlordId,

      startDate,
      endDate,
      nextPaymentDue,

      externalId: dto.externalId,

      monthlyRentWithoutBills: dto.monthlyRentWithoutBills,
      monthlyRentWithBills: dto.monthlyRentWithBills,
      billsIncludedAmount: dto.billsIncludedAmount,

      depositAmount: dto.depositAmount,
      adminFeeAmount: dto.adminFeeAmount,
      otherFeesAmount: dto.otherFeesAmount,

      bookingCostAmount: dto.bookingCostAmount,
      bookingCostDate: dto.bookingCostDate ? this.requireDate(dto.bookingCostDate, 'bookingCostDate') : undefined,

      registrationTaxAmount: dto.registrationTaxAmount,
      registrationTaxDate: dto.registrationTaxDate
        ? this.requireDate(dto.registrationTaxDate, 'registrationTaxDate')
        : undefined,

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

    if (dto.propertyId) {
      const propSnap = await this.propertiesDoc(holderId, dto.propertyId).get();
      if (!propSnap.exists) throw new NotFoundException(`Property ${dto.propertyId} not found`);
      const prop = propSnap.data() as any;

      const current = doc.data() as any;
      const effectiveType: LeaseType = (dto.type ?? current.type) as LeaseType;

      if (effectiveType === LeaseType.LANDLORD && prop?.type && prop.type !== 'APARTMENT') {
        throw new BadRequestException('LANDLORD lease must be linked to a property of type APARTMENT');
      }
    }

    const updateData = this.cleanData({
      ...dto,

      startDate: dto.startDate ? this.requireDate(dto.startDate, 'startDate') : undefined,
      endDate: dto.endDate ? this.requireDate(dto.endDate, 'endDate') : undefined,
      nextPaymentDue: dto.nextPaymentDue ? this.requireDate(dto.nextPaymentDue, 'nextPaymentDue') : undefined,

      bookingCostDate: dto.bookingCostDate ? this.requireDate(dto.bookingCostDate, 'bookingCostDate') : undefined,
      registrationTaxDate: dto.registrationTaxDate
        ? this.requireDate(dto.registrationTaxDate, 'registrationTaxDate')
        : undefined,

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
    await ref.delete();
    return { success: true };
  }

  // -------------------------
  // Schedule helpers
  // -------------------------
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

  private addDaysUTC(d: Date, days: number): Date {
    const nd = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    nd.setUTCDate(nd.getUTCDate() + days);
    return nd;
  }

  private computeDueDateForMonth(base: Date, dueDayOfMonth: number): Date {
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    const day = Math.max(1, Math.min(28, dueDayOfMonth));
    return new Date(Date.UTC(y, m, day));
  }

  private async deriveApartmentId(holderId: string, propertyId: string): Promise<string> {
    const propSnap = await this.propertiesDoc(holderId, propertyId).get();
    if (!propSnap.exists) throw new NotFoundException(`Property ${propertyId} not found`);
    const prop = propSnap.data() as any;

    if (prop?.type === 'APARTMENT') return propertyId;

    const apartmentId = prop?.apartmentId;
    if (!apartmentId) {
      throw new BadRequestException(
        `Property ${propertyId} is not APARTMENT and has no apartmentId. Set properties.apartmentId on ROOM/BED.`,
      );
    }
    return apartmentId;
  }

  async generateSchedule(holderId: string, leaseId: string, monthsIfNoEnd = 12) {
    const leaseSnap = await this.leasesCollection(holderId).doc(leaseId).get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const lease = leaseSnap.data() as any;

    const type: LeaseType = lease.type;
    const propertyId: string = lease.propertyId;
    if (!propertyId) throw new BadRequestException('lease.propertyId missing');

    const tenantId: string | undefined = lease.tenantId;
    const landlordId: string | undefined = lease.landlordId;

    // ✅ QUI la differenza: parse robusto (string/timestamp)
    const startDate = this.requireDate(lease.startDate, 'lease.startDate');
    const endDate: Date | undefined = this.parseAnyDateLike(lease.endDate);
    const firstDue: Date | undefined = this.parseAnyDateLike(lease.nextPaymentDue);

    const dueDayOfMonth: number = lease.dueDayOfMonth ?? 5;

    if (type === LeaseType.TENANT) {
      if (!tenantId) throw new BadRequestException('TENANT lease missing tenantId');
    } else {
      if (!landlordId) throw new BadRequestException('LANDLORD lease missing landlordId');
    }

    const apartmentId =
      type === LeaseType.LANDLORD ? propertyId : await this.deriveApartmentId(holderId, propertyId);

    const aptSnap = await this.propertiesDoc(holderId, apartmentId).get();
    const buildingId = aptSnap.exists ? (aptSnap.data() as any)?.buildingId : undefined;

    const amountNet: number = Number(lease.monthlyRentWithoutBills);

    const batch = this.firebaseService.firestore.batch();

    // -------------------------
    // EXTRA CASHFLOWS (TENANT)
    // -------------------------
    if (type === LeaseType.TENANT) {
      const startISO = this.isoDate(startDate);
      const startMonth = this.monthKey(startDate);

      const depositAmount = lease.depositAmount !== undefined ? Number(lease.depositAmount) : undefined;
      const adminFeeAmount = lease.adminFeeAmount !== undefined ? Number(lease.adminFeeAmount) : undefined;

      if (depositAmount && depositAmount > 0) {
        const ref = this.paymentsCollection(holderId).doc(`${leaseId}_deposit_start`);
        batch.set(
          ref,
          this.cleanData({
            leaseId,
            tenantId,
            propertyId,
            apartmentId,
            buildingId: buildingId ?? undefined,
            dueDate: startISO,
            paidDate: undefined,
            amount: depositAmount,
            currency: 'EUR',
            kind: 'DEPOSIT',
            status: 'PLANNED',
            period: startMonth,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      }

      if (adminFeeAmount && adminFeeAmount > 0) {
        const ref = this.paymentsCollection(holderId).doc(`${leaseId}_admin_fee_start`);
        batch.set(
          ref,
          this.cleanData({
            leaseId,
            tenantId,
            propertyId,
            apartmentId,
            buildingId: buildingId ?? undefined,
            dueDate: startISO,
            paidDate: undefined,
            amount: adminFeeAmount,
            currency: 'EUR',
            kind: 'ADMIN_FEE',
            status: 'PLANNED',
            period: startMonth,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      }

      const bookingCostAmount = lease.bookingCostAmount !== undefined ? Number(lease.bookingCostAmount) : undefined;
      const bookingCostDate: Date | undefined = this.parseAnyDateLike(lease.bookingCostDate);

      if (bookingCostAmount && bookingCostAmount > 0) {
        const d = bookingCostDate ?? startDate;
        const ref = this.expensesCollection(holderId).doc(`${leaseId}_booking_cost`);
        batch.set(
          ref,
          this.cleanData({
            leaseId,
            propertyId: apartmentId,
            costDate: this.isoDate(d),
            costMonth: this.monthKey(d),
            amount: bookingCostAmount,
            currency: 'EUR',
            type: 'BOOKING_COST',
            scope: 'UNIT',
            status: 'PLANNED',
            notes: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      }

      const registrationTaxAmount =
        lease.registrationTaxAmount !== undefined ? Number(lease.registrationTaxAmount) : undefined;
      const registrationTaxDate: Date | undefined = this.parseAnyDateLike(lease.registrationTaxDate);

      if (registrationTaxAmount && registrationTaxAmount > 0) {
        const d = registrationTaxDate ?? startDate;
        const ref = this.expensesCollection(holderId).doc(`${leaseId}_registration_tax`);
        batch.set(
          ref,
          this.cleanData({
            leaseId,
            propertyId: apartmentId,
            costDate: this.isoDate(d),
            costMonth: this.monthKey(d),
            amount: registrationTaxAmount,
            currency: 'EUR',
            type: 'REGISTRATION_TAX',
            scope: 'UNIT',
            status: 'PLANNED',
            notes: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      }

      if (depositAmount && depositAmount > 0 && endDate) {
        const refundDate = this.addDaysUTC(endDate, 60);
        const ref = this.expensesCollection(holderId).doc(`${leaseId}_deposit_refund`);
        batch.set(
          ref,
          this.cleanData({
            leaseId,
            propertyId: apartmentId,
            costDate: this.isoDate(refundDate),
            costMonth: this.monthKey(refundDate),
            amount: depositAmount,
            currency: 'EUR',
            type: 'DEPOSIT_REFUND',
            scope: 'UNIT',
            status: 'PLANNED',
            notes: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      }
    }

    // -------------------------
    // RENT MONTHLY (TENANT -> payments, LANDLORD -> expenses)
    // -------------------------

    const startMonthCursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const maxEnd = endDate
      ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))
      : this.addMonthsUTC(startMonthCursor, monthsIfNoEnd - 1);

    let dueCursor: Date | undefined = firstDue
      ? new Date(Date.UTC(firstDue.getUTCFullYear(), firstDue.getUTCMonth(), Math.min(28, firstDue.getUTCDate())))
      : undefined;

    let cursor = startMonthCursor;
    while (cursor.getTime() <= maxEnd.getTime()) {
      const period = this.monthKey(cursor);

      let dueDate: Date;
      if (dueCursor) {
        while (
          dueCursor.getUTCFullYear() < cursor.getUTCFullYear() ||
          (dueCursor.getUTCFullYear() === cursor.getUTCFullYear() && dueCursor.getUTCMonth() < cursor.getUTCMonth())
        ) {
          dueCursor = this.addMonthsUTC(dueCursor, 1);
          dueCursor = new Date(Date.UTC(dueCursor.getUTCFullYear(), dueCursor.getUTCMonth(), Math.min(28, dueCursor.getUTCDate())));
        }

        if (dueCursor.getUTCFullYear() === cursor.getUTCFullYear() && dueCursor.getUTCMonth() === cursor.getUTCMonth()) {
          dueDate = dueCursor;
          const next = this.addMonthsUTC(dueCursor, 1);
          dueCursor = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), Math.min(28, dueDate.getUTCDate())));
        } else {
          dueDate = this.computeDueDateForMonth(cursor, dueDayOfMonth);
        }
      } else {
        dueDate = this.computeDueDateForMonth(cursor, dueDayOfMonth);
      }

      if (type === LeaseType.TENANT) {
        const gross = lease.monthlyRentWithBills;
        const bills = lease.billsIncludedAmount;
        const amount =
          gross !== undefined ? Number(gross) : bills !== undefined ? Number(amountNet) + Number(bills) : Number(amountNet);

        const ref = this.paymentsCollection(holderId).doc(`${leaseId}_rent_${period}`);

        batch.set(
          ref,
          this.cleanData({
            leaseId,
            tenantId,
            propertyId,
            apartmentId,
            buildingId: buildingId ?? undefined,
            dueDate: this.isoDate(dueDate),
            paidDate: undefined,
            amount,
            currency: 'EUR',
            kind: 'RENT',
            status: 'PLANNED',
            period,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      } else {
        const ref = this.expensesCollection(holderId).doc(`${leaseId}_rent_to_landlord_${period}`);

        batch.set(
          ref,
          this.cleanData({
            leaseId,
            propertyId,
            landlordId,
            costDate: this.isoDate(dueDate),
            costMonth: period,
            amount: Number(amountNet),
            currency: 'EUR',
            type: 'RENT_TO_LANDLORD',
            scope: 'UNIT',
            status: 'PLANNED',
            notes: undefined,
            createdAt: new Date(),
            updatedAt: new Date(),
          }),
          { merge: true },
        );
      }

      cursor = this.addMonthsUTC(cursor, 1);
    }

    await batch.commit();
    return { success: true };
  }
}
