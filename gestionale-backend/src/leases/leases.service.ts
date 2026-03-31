
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

  bookingDate: Date;
  startDate: Date;
  endDate?: Date;
  nextPaymentDue?: Date;

  externalId?: string;

  monthlyRentWithoutBills: number;
  monthlyRentWithBills?: number;
  billsIncludedAmount?: number;

  depositAmount?: number;
  depositDate?: Date;
  adminFeeAmount?: number;
  adminFeeDate?: Date;
  otherFeesAmount?: number;

  bookingCostAmount?: number;
  bookingCostDate?: Date;

  registrationTaxAmount?: number;
  registrationTaxDate?: Date;

  dueDayOfMonth?: number;

  createdAt: Date;
  updatedAt: Date;
  scheduleGeneratedAt?: Date;
};

type GeneratedDocMaps = {
  payments: Map<string, any>;
  expenses: Map<string, any>;
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

  private parseAnyDateLike(value: any): Date | undefined {
    if (value === null || value === undefined) return undefined;

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? undefined : value;
    }

    if (typeof value === 'string') {
      const s = value.trim();
      if (!s) return undefined;

      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(s + 'T00:00:00.000Z');
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

  private requireDate(value: any, fieldName: string): Date {
    const d = this.parseAnyDateLike(value);
    if (!d) throw new BadRequestException(`${fieldName} is missing or invalid`);
    return d;
  }

  private isoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
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
    const data = this.cleanData({ ...dto, storagePath: (dto as any).storagePath ?? (dto as any).path, createdAt: new Date() } as any);

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, leaseId: string) {
    const leaseRef = this.leasesCollection(holderId).doc(leaseId);
    const leaseSnap = await leaseRef.get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

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

    const bookingDate = dto.bookingDate ? this.requireDate(dto.bookingDate, 'bookingDate') : new Date();
    const startDate = this.requireDate(dto.startDate, 'startDate');
    const endDate = dto.endDate ? this.requireDate(dto.endDate, 'endDate') : undefined;
    const nextPaymentDue = dto.nextPaymentDue
      ? this.requireDate(dto.nextPaymentDue, 'nextPaymentDue')
      : undefined;
    const depositDate = dto.depositDate ? this.requireDate(dto.depositDate, 'depositDate') : bookingDate;
    const adminFeeDate = dto.adminFeeDate ? this.requireDate(dto.adminFeeDate, 'adminFeeDate') : bookingDate;
    const bookingCostDate = dto.bookingCostDate
      ? this.requireDate(dto.bookingCostDate, 'bookingCostDate')
      : bookingDate;
    const registrationTaxDate = dto.registrationTaxDate
      ? this.requireDate(dto.registrationTaxDate, 'registrationTaxDate')
      : bookingDate;

    const data: LeaseDoc = this.cleanData({
      type: dto.type,
      propertyId: dto.propertyId,
      tenantId: dto.tenantId,
      landlordId: dto.landlordId,

      bookingDate,
      startDate,
      endDate,
      nextPaymentDue,

      externalId: dto.externalId,

      monthlyRentWithoutBills: dto.monthlyRentWithoutBills,
      monthlyRentWithBills: dto.monthlyRentWithBills,
      billsIncludedAmount: dto.billsIncludedAmount,

      depositAmount: dto.depositAmount,
      depositDate,
      adminFeeAmount: dto.adminFeeAmount,
      adminFeeDate,
      otherFeesAmount: dto.otherFeesAmount,

      bookingCostAmount: dto.bookingCostAmount,
      bookingCostDate,

      registrationTaxAmount: dto.registrationTaxAmount,
      registrationTaxDate,

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

    const current = doc.data() as any;

    if (dto.propertyId) {
      const propSnap = await this.propertiesDoc(holderId, dto.propertyId).get();
      if (!propSnap.exists) throw new NotFoundException(`Property ${dto.propertyId} not found`);
      const prop = propSnap.data() as any;

      const effectiveType: LeaseType = (dto.type ?? current.type) as LeaseType;

      if (effectiveType === LeaseType.LANDLORD && prop?.type && prop.type !== 'APARTMENT') {
        throw new BadRequestException('LANDLORD lease must be linked to a property of type APARTMENT');
      }
    }

    const mergedBookingDate =
      dto.bookingDate !== undefined
        ? this.requireDate(dto.bookingDate, 'bookingDate')
        : this.parseAnyDateLike(current.bookingDate);

    const updateData = this.cleanData({
      ...dto,

      bookingDate: dto.bookingDate ? this.requireDate(dto.bookingDate, 'bookingDate') : undefined,
      startDate: dto.startDate ? this.requireDate(dto.startDate, 'startDate') : undefined,
      endDate: dto.endDate ? this.requireDate(dto.endDate, 'endDate') : undefined,
      nextPaymentDue: dto.nextPaymentDue ? this.requireDate(dto.nextPaymentDue, 'nextPaymentDue') : undefined,

      depositDate:
        dto.depositDate !== undefined
          ? this.requireDate(dto.depositDate, 'depositDate')
          : dto.bookingDate !== undefined
            ? mergedBookingDate
            : undefined,
      adminFeeDate:
        dto.adminFeeDate !== undefined
          ? this.requireDate(dto.adminFeeDate, 'adminFeeDate')
          : dto.bookingDate !== undefined
            ? mergedBookingDate
            : undefined,
      bookingCostDate:
        dto.bookingCostDate !== undefined
          ? this.requireDate(dto.bookingCostDate, 'bookingCostDate')
          : dto.bookingDate !== undefined
            ? mergedBookingDate
            : undefined,
      registrationTaxDate:
        dto.registrationTaxDate !== undefined
          ? this.requireDate(dto.registrationTaxDate, 'registrationTaxDate')
          : dto.bookingDate !== undefined
            ? mergedBookingDate
            : undefined,

      updatedAt: new Date(),
    } as any);

    await ref.set(updateData, { merge: true });
    const updatedSnap = await ref.get();
    const updatedLease = updatedSnap.data() as any;

    if (await this.hasGeneratedScheduleDocsForLease(holderId, leaseId)) {
      await this.syncGeneratedScheduleForLease(holderId, leaseId, updatedLease);
      const finalSnap = await ref.get();
      return { id: finalSnap.id, ...(finalSnap.data() as any) };
    }

    return { id: updatedSnap.id, ...(updatedSnap.data() as any) };
  }

  async remove(holderId: string, leaseId: string) {
    const ref = this.leasesCollection(holderId).doc(leaseId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`Lease ${leaseId} not found`);
    await ref.delete();
    return { success: true };
  }

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

  private isGeneratedLeaseScheduleDocId(leaseId: string, docId: string): boolean {
    return docId.startsWith(`${leaseId}_`);
  }

  private isPaidLike(data: any): boolean {
    return String(data?.status ?? '').toUpperCase() === 'PAID';
  }

  private async hasGeneratedScheduleDocsForLease(holderId: string, leaseId: string): Promise<boolean> {
    const [paymentsSnap, expensesSnap, leaseSnap] = await Promise.all([
      this.paymentsCollection(holderId).where('leaseId', '==', leaseId).get(),
      this.expensesCollection(holderId).where('leaseId', '==', leaseId).get(),
      this.leasesCollection(holderId).doc(leaseId).get(),
    ]);

    const lease = leaseSnap.exists ? (leaseSnap.data() as any) : undefined;
    if (this.parseAnyDateLike(lease?.scheduleGeneratedAt)) return true;

    const hasPayment = paymentsSnap.docs.some(
      (d) => d.data()?.generatedFromLeaseSchedule === true || this.isGeneratedLeaseScheduleDocId(leaseId, d.id),
    );
    const hasExpense = expensesSnap.docs.some(
      (d) => d.data()?.generatedFromLeaseSchedule === true || this.isGeneratedLeaseScheduleDocId(leaseId, d.id),
    );

    return hasPayment || hasExpense;
  }

  private async scheduleDocsExistForLease(
    holderId: string,
    leaseId: string,
    lease: any,
    startDate: Date,
  ): Promise<boolean> {
    if (this.parseAnyDateLike(lease?.scheduleGeneratedAt)) return true;

    const type: LeaseType = lease.type;
    const firstPeriod = this.monthKey(new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)));

    const refs = [
      type === LeaseType.TENANT
        ? this.paymentsCollection(holderId).doc(`${leaseId}_rent_${firstPeriod}`)
        : this.expensesCollection(holderId).doc(`${leaseId}_rent_to_landlord_${firstPeriod}`),
      this.expensesCollection(holderId).doc(`${leaseId}_booking_cost`),
      this.expensesCollection(holderId).doc(`${leaseId}_registration_tax`),
      this.expensesCollection(holderId).doc(`${leaseId}_deposit_refund`),
    ];

    if (type === LeaseType.TENANT) {
      refs.push(this.paymentsCollection(holderId).doc(`${leaseId}_deposit_start`));
      refs.push(this.paymentsCollection(holderId).doc(`${leaseId}_admin_fee_start`));
    } else {
      refs.push(this.expensesCollection(holderId).doc(`${leaseId}_deposit_to_landlord`));
      refs.push(this.paymentsCollection(holderId).doc(`${leaseId}_deposit_return_from_landlord`));
      refs.push(this.expensesCollection(holderId).doc(`${leaseId}_admin_fee_to_landlord`));
    }

    const snaps = await Promise.all(refs.map((ref) => ref.get()));
    return snaps.some((snap) => snap.exists);
  }

  private async buildGeneratedScheduleDocs(
    holderId: string,
    leaseId: string,
    lease: any,
    monthsIfNoEnd = 12,
  ): Promise<GeneratedDocMaps> {
    const type: LeaseType = lease.type;
    const propertyId: string = lease.propertyId;
    if (!propertyId) throw new BadRequestException('lease.propertyId missing');

    const tenantId: string | undefined = lease.tenantId;
    const landlordId: string | undefined = lease.landlordId;

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
    const now = new Date();

    const bookingDate: Date | undefined = this.parseAnyDateLike(lease.bookingDate);
    const depositAmount = lease.depositAmount !== undefined ? Number(lease.depositAmount) : undefined;
    const depositDate: Date = this.parseAnyDateLike(lease.depositDate) ?? bookingDate ?? startDate;
    const adminFeeAmount = lease.adminFeeAmount !== undefined ? Number(lease.adminFeeAmount) : undefined;
    const adminFeeDate: Date = this.parseAnyDateLike(lease.adminFeeDate) ?? bookingDate ?? startDate;
    const bookingCostAmount = lease.bookingCostAmount !== undefined ? Number(lease.bookingCostAmount) : undefined;
    const bookingCostDate: Date = this.parseAnyDateLike(lease.bookingCostDate) ?? bookingDate ?? startDate;
    const registrationTaxAmount =
      lease.registrationTaxAmount !== undefined ? Number(lease.registrationTaxAmount) : undefined;
    const registrationTaxDate: Date =
      this.parseAnyDateLike(lease.registrationTaxDate) ?? bookingDate ?? startDate;

    const payments = new Map<string, any>();
    const expenses = new Map<string, any>();

    if (type === LeaseType.TENANT) {
      if (depositAmount && depositAmount > 0) {
        payments.set(
          `${leaseId}_deposit_start`,
          this.cleanData({
            leaseId,
            tenantId,
            propertyId,
            apartmentId,
            buildingId: buildingId ?? undefined,
            dueDate: this.isoDate(depositDate),
            paidDate: undefined,
            amount: depositAmount,
            currency: 'EUR',
            kind: 'DEPOSIT',
            status: 'PLANNED',
            period: this.monthKey(depositDate),
            generatedFromLeaseSchedule: true,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }

      if (adminFeeAmount && adminFeeAmount > 0) {
        payments.set(
          `${leaseId}_admin_fee_start`,
          this.cleanData({
            leaseId,
            tenantId,
            propertyId,
            apartmentId,
            buildingId: buildingId ?? undefined,
            dueDate: this.isoDate(adminFeeDate),
            paidDate: undefined,
            amount: adminFeeAmount,
            currency: 'EUR',
            kind: 'ADMIN_FEE',
            status: 'PLANNED',
            period: this.monthKey(adminFeeDate),
            generatedFromLeaseSchedule: true,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
    } else {
      if (depositAmount && depositAmount > 0) {
        expenses.set(
          `${leaseId}_deposit_to_landlord`,
          this.cleanData({
            leaseId,
            propertyId: apartmentId,
            landlordId,
            costDate: this.isoDate(depositDate),
            costMonth: this.monthKey(depositDate),
            amount: depositAmount,
            currency: 'EUR',
            type: 'DEPOSIT_TO_LANDLORD',
            scope: 'UNIT',
            status: 'PLANNED',
            notes: undefined,
            generatedFromLeaseSchedule: true,
            createdAt: now,
            updatedAt: now,
          }),
        );

        if (endDate) {
          payments.set(
            `${leaseId}_deposit_return_from_landlord`,
            this.cleanData({
              leaseId,
              landlordId,
              propertyId,
              apartmentId,
              buildingId: buildingId ?? undefined,
              dueDate: this.isoDate(endDate),
              paidDate: undefined,
              amount: depositAmount,
              currency: 'EUR',
              kind: 'DEPOSIT_RETURN_FROM_LANDLORD',
              status: 'PLANNED',
              period: this.monthKey(endDate),
              generatedFromLeaseSchedule: true,
              createdAt: now,
              updatedAt: now,
            }),
          );
        }
      }

      if (adminFeeAmount && adminFeeAmount > 0) {
        expenses.set(
          `${leaseId}_admin_fee_to_landlord`,
          this.cleanData({
            leaseId,
            propertyId: apartmentId,
            landlordId,
            costDate: this.isoDate(adminFeeDate),
            costMonth: this.monthKey(adminFeeDate),
            amount: adminFeeAmount,
            currency: 'EUR',
            type: 'ADMIN_FEE_TO_LANDLORD',
            scope: 'UNIT',
            status: 'PLANNED',
            notes: undefined,
            generatedFromLeaseSchedule: true,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }
    }

    if (bookingCostAmount && bookingCostAmount > 0) {
      expenses.set(
        `${leaseId}_booking_cost`,
        this.cleanData({
          leaseId,
          propertyId: apartmentId,
          costDate: this.isoDate(bookingCostDate),
          costMonth: this.monthKey(bookingCostDate),
          amount: bookingCostAmount,
          currency: 'EUR',
          type: 'BOOKING_COST',
          scope: 'UNIT',
          status: 'PLANNED',
          notes: undefined,
          generatedFromLeaseSchedule: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    if (registrationTaxAmount && registrationTaxAmount > 0) {
      expenses.set(
        `${leaseId}_registration_tax`,
        this.cleanData({
          leaseId,
          propertyId: apartmentId,
          costDate: this.isoDate(registrationTaxDate),
          costMonth: this.monthKey(registrationTaxDate),
          amount: registrationTaxAmount,
          currency: 'EUR',
          type: 'REGISTRATION_TAX',
          scope: 'UNIT',
          status: 'PLANNED',
          notes: undefined,
          generatedFromLeaseSchedule: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

    if (type === LeaseType.TENANT && depositAmount && depositAmount > 0 && endDate) {
      const refundDate = this.addDaysUTC(endDate, 60);
      expenses.set(
        `${leaseId}_deposit_refund`,
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
          generatedFromLeaseSchedule: true,
          createdAt: now,
          updatedAt: now,
        }),
      );
    }

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
          dueCursor = new Date(
            Date.UTC(dueCursor.getUTCFullYear(), dueCursor.getUTCMonth(), Math.min(28, dueCursor.getUTCDate())),
          );
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

        payments.set(
          `${leaseId}_rent_${period}`,
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
            generatedFromLeaseSchedule: true,
            createdAt: now,
            updatedAt: now,
          }),
        );
      } else {
        expenses.set(
          `${leaseId}_rent_to_landlord_${period}`,
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
            generatedFromLeaseSchedule: true,
            createdAt: now,
            updatedAt: now,
          }),
        );
      }

      cursor = this.addMonthsUTC(cursor, 1);
    }

    return { payments, expenses };
  }

  private async syncGeneratedScheduleForLease(holderId: string, leaseId: string, lease: any, monthsIfNoEnd = 12) {
    const expected = await this.buildGeneratedScheduleDocs(holderId, leaseId, lease, monthsIfNoEnd);

    const [paymentsSnap, expensesSnap] = await Promise.all([
      this.paymentsCollection(holderId).where('leaseId', '==', leaseId).get(),
      this.expensesCollection(holderId).where('leaseId', '==', leaseId).get(),
    ]);

    const batch = this.firebaseService.firestore.batch();
    const now = new Date();

    const existingPayments = new Map<string, any>();
    for (const doc of paymentsSnap.docs) {
      if (doc.data()?.generatedFromLeaseSchedule === true || this.isGeneratedLeaseScheduleDocId(leaseId, doc.id)) {
        existingPayments.set(doc.id, { ref: doc.ref, data: doc.data() });
      }
    }

    const existingExpenses = new Map<string, any>();
    for (const doc of expensesSnap.docs) {
      if (doc.data()?.generatedFromLeaseSchedule === true || this.isGeneratedLeaseScheduleDocId(leaseId, doc.id)) {
        existingExpenses.set(doc.id, { ref: doc.ref, data: doc.data() });
      }
    }

    for (const [docId, expectedData] of expected.payments.entries()) {
      const existing = existingPayments.get(docId);
      if (existing) {
        if (this.isPaidLike(existing.data)) continue;
        batch.set(
          existing.ref,
          this.cleanData({
            ...expectedData,
            status: 'PLANNED',
            paidDate: undefined,
            createdAt: existing.data?.createdAt ?? expectedData.createdAt ?? now,
            updatedAt: now,
          }),
          { merge: true },
        );
      } else {
        batch.set(
          this.paymentsCollection(holderId).doc(docId),
          this.cleanData({
            ...expectedData,
            createdAt: expectedData.createdAt ?? now,
            updatedAt: now,
          }),
          { merge: false },
        );
      }
    }

    for (const [docId, existing] of existingPayments.entries()) {
      if (expected.payments.has(docId)) continue;
      if (this.isPaidLike(existing.data)) continue;
      batch.delete(existing.ref);
    }

    for (const [docId, expectedData] of expected.expenses.entries()) {
      const existing = existingExpenses.get(docId);
      if (existing) {
        if (this.isPaidLike(existing.data)) continue;
        batch.set(
          existing.ref,
          this.cleanData({
            ...expectedData,
            status: 'PLANNED',
            createdAt: existing.data?.createdAt ?? expectedData.createdAt ?? now,
            updatedAt: now,
          }),
          { merge: true },
        );
      } else {
        batch.set(
          this.expensesCollection(holderId).doc(docId),
          this.cleanData({
            ...expectedData,
            createdAt: expectedData.createdAt ?? now,
            updatedAt: now,
          }),
          { merge: false },
        );
      }
    }

    for (const [docId, existing] of existingExpenses.entries()) {
      if (expected.expenses.has(docId)) continue;
      if (this.isPaidLike(existing.data)) continue;
      batch.delete(existing.ref);
    }

    batch.set(
      this.leasesCollection(holderId).doc(leaseId),
      {
        scheduleGeneratedAt: this.parseAnyDateLike(lease.scheduleGeneratedAt) ?? now,
        updatedAt: now,
      },
      { merge: true },
    );

    await batch.commit();
  }

  async generateSchedules(holderId: string, leaseIds: string[], monthsIfNoEnd = 12) {
    const uniqueLeaseIds = Array.from(new Set((leaseIds ?? []).map((x) => String(x).trim()).filter(Boolean)));

    if (uniqueLeaseIds.length === 0) {
      throw new BadRequestException('leaseIds must contain at least one lease id');
    }

    const results: Array<{ leaseId: string; success: boolean; skipped?: boolean; reason?: string; error?: string }> = [];

    for (const leaseId of uniqueLeaseIds) {
      try {
        const result = await this.generateSchedule(holderId, leaseId, monthsIfNoEnd);
        results.push({
          leaseId,
          success: true,
          skipped: Boolean((result as any)?.skipped),
          reason: (result as any)?.reason,
        });
      } catch (err) {
        results.push({
          leaseId,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return {
      success: results.every((x) => x.success),
      requested: uniqueLeaseIds.length,
      generated: results.filter((x) => x.success && !x.skipped).length,
      skipped: results.filter((x) => x.success && x.skipped).length,
      failed: results.filter((x) => !x.success).length,
      results,
    };
  }

  async generateSchedule(holderId: string, leaseId: string, monthsIfNoEnd = 12) {
    const leaseRef = this.leasesCollection(holderId).doc(leaseId);
    const leaseSnap = await leaseRef.get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const lease = leaseSnap.data() as any;
    const startDate = this.requireDate(lease.startDate, 'lease.startDate');

    if (await this.scheduleDocsExistForLease(holderId, leaseId, lease, startDate)) {
      await leaseRef.set(
        {
          scheduleGeneratedAt: this.parseAnyDateLike(lease.scheduleGeneratedAt) ?? new Date(),
          updatedAt: new Date(),
        },
        { merge: true },
      );

      return {
        success: true,
        skipped: true,
        reason: 'already-generated',
      };
    }

    const expected = await this.buildGeneratedScheduleDocs(holderId, leaseId, lease, monthsIfNoEnd);
    const batch = this.firebaseService.firestore.batch();
    const now = new Date();

    for (const [docId, data] of expected.payments.entries()) {
      batch.set(this.paymentsCollection(holderId).doc(docId), data, { merge: false });
    }

    for (const [docId, data] of expected.expenses.entries()) {
      batch.set(this.expensesCollection(holderId).doc(docId), data, { merge: false });
    }

    batch.set(
      leaseRef,
      {
        scheduleGeneratedAt: now,
        updatedAt: now,
      },
      { merge: true },
    );

    await batch.commit();
    return { success: true, generated: true };
  }
}
