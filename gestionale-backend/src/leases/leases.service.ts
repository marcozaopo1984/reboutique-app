import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreateLeaseDto, LeaseType } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';

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
      if (
        dto.monthlyRentWithBills !== undefined &&
        dto.billsIncludedAmount !== undefined
      ) {
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
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
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
    // base indicates the month/year
    const y = base.getUTCFullYear();
    const m = base.getUTCMonth();
    const day = Math.max(1, Math.min(28, dueDayOfMonth)); // evita problemi su febbraio/mesi corti
    return new Date(Date.UTC(y, m, day));
  }

  /**
   * Genera righe mensili:
   * - TENANT => payments
   * - LANDLORD => expenses
   *
   * Regola:
   * - se nextPaymentDue esiste: quella è la prima dueDate, poi +1 mese mantenendo il giorno (clamp 28)
   * - altrimenti usa dueDayOfMonth (default 5)
   *
   * Genera fino a endDate (se presente) altrimenti per N mesi (default 12) per non esplodere.
   */
  async generateSchedule(holderId: string, leaseId: string, monthsIfNoEnd = 12) {
    const leaseSnap = await this.leasesCollection(holderId).doc(leaseId).get();
    if (!leaseSnap.exists) throw new NotFoundException(`Lease ${leaseId} not found`);

    const lease = leaseSnap.data() as any;

    const type: LeaseType = lease.type;
    const propertyId: string = lease.propertyId;
    const tenantId: string | undefined = lease.tenantId;
    const landlordId: string | undefined = lease.landlordId;

    const startDate = new Date(lease.startDate);
    const endDate: Date | undefined = lease.endDate ? new Date(lease.endDate) : undefined;
    const firstDue: Date | undefined = lease.nextPaymentDue ? new Date(lease.nextPaymentDue) : undefined;

    const dueDayOfMonth: number = lease.dueDayOfMonth ?? 5;
    const amountNet: number = Number(lease.monthlyRentWithoutBills);

    if (!propertyId) throw new BadRequestException('lease.propertyId missing');

    if (type === LeaseType.TENANT) {
      if (!tenantId) throw new BadRequestException('TENANT lease missing tenantId');
    } else {
      if (!landlordId) throw new BadRequestException('LANDLORD lease missing landlordId');
    }

    // determiniamo il range mensile
    const startMonth = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));
    const maxEnd = endDate
      ? new Date(Date.UTC(endDate.getUTCFullYear(), endDate.getUTCMonth(), 1))
      : this.addMonthsUTC(startMonth, monthsIfNoEnd - 1);

    // calcolo prima scadenza
    let dueCursor: Date | undefined = firstDue
      ? new Date(Date.UTC(firstDue.getUTCFullYear(), firstDue.getUTCMonth(), Math.min(28, firstDue.getUTCDate())))
      : undefined;

    const batch = this.firebaseService.firestore.batch();

    let cursor = startMonth;
    while (cursor.getTime() <= maxEnd.getTime()) {
      const period = this.monthKey(cursor);

      // dueDate: se firstDue c’è, usa quella nel suo mese e poi +1 mese
      let dueDate: Date;
      if (dueCursor) {
        // allineo al mese corrente: se per qualche motivo la dueCursor è dietro, la avanzo
        while (
          dueCursor.getUTCFullYear() < cursor.getUTCFullYear() ||
          (dueCursor.getUTCFullYear() === cursor.getUTCFullYear() && dueCursor.getUTCMonth() < cursor.getUTCMonth())
        ) {
          dueCursor = this.addMonthsUTC(dueCursor, 1);
          dueCursor = new Date(Date.UTC(dueCursor.getUTCFullYear(), dueCursor.getUTCMonth(), Math.min(28, dueCursor.getUTCDate())));
        }
        // se è avanti rispetto al mese, comunque calcolo default per il mese
        if (
          dueCursor.getUTCFullYear() === cursor.getUTCFullYear() &&
          dueCursor.getUTCMonth() === cursor.getUTCMonth()
        ) {
          dueDate = dueCursor;
          // prepara successiva
          const next = this.addMonthsUTC(dueCursor, 1);
          dueCursor = new Date(Date.UTC(next.getUTCFullYear(), next.getUTCMonth(), Math.min(28, dueCursor.getUTCDate())));
        } else {
          dueDate = this.computeDueDateForMonth(cursor, dueDayOfMonth);
        }
      } else {
        dueDate = this.computeDueDateForMonth(cursor, dueDayOfMonth);
      }

      if (type === LeaseType.TENANT) {
        // amountDue: se vuoi usare "with bills" come dovuto, usa quella; altrimenti net (+bills)
        const gross = lease.monthlyRentWithBills;
        const bills = lease.billsIncludedAmount;
        const amountDue =
          gross !== undefined
            ? Number(gross)
            : bills !== undefined
              ? Number(amountNet) + Number(bills)
              : Number(amountNet);

        const ref = this.paymentsCollection(holderId).doc(); // auto id
        batch.set(ref, this.cleanData({
          leaseId,
          type: 'TENANT',
          propertyId,
          tenantId,
          period,
          dueDate,
          amountDue,
          status: 'DUE',
          createdAt: new Date(),
        }));
      } else {
        const ref = this.expensesCollection(holderId).doc();
        batch.set(ref, this.cleanData({
          leaseId,
          type: 'LANDLORD',
          propertyId,
          landlordId,
          period,
          dueDate,
          amount: Number(amountNet),
          category: 'RENT_TO_LANDLORD',
          status: 'DUE',
          createdAt: new Date(),
        }));
      }

      cursor = this.addMonthsUTC(cursor, 1);
    }

    await batch.commit();
    return { success: true };
  }
}
