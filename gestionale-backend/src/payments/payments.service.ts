import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { FirebaseService } from '../firebase/firebase.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { CreatePaymentFileDto } from './dto/create-payment-file.dto';
import * as admin from 'firebase-admin';

@Injectable()
export class PaymentsService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private paymentsCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('payments');
  }

  private paymentFilesCollection(holderId: string, paymentId: string) {
    return this.paymentsCollection(holderId).doc(paymentId).collection('files');
  }

  private propertiesDoc(holderId: string, propertyId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('properties')
      .doc(propertyId);
  }

  private clean<T extends Record<string, any>>(data: T): Partial<T> {
    const out: any = {};
    for (const [key, val] of Object.entries(data)) {
      if (val !== undefined) out[key] = val;
    }
    return out;
  }

  /**
   * ✅ Deriva apartmentId dalla property:
   * - se property.type == 'APARTMENT' => apartmentId = propertyId
   * - altrimenti => apartmentId = property.apartmentId (obbligatorio)
   */
  private async deriveApartmentId(holderId: string, propertyId: string): Promise<string> {
    const propSnap = await this.propertiesDoc(holderId, propertyId).get();
    if (!propSnap.exists) throw new NotFoundException(`Property ${propertyId} not found`);

    const prop = propSnap.data() as any;
    const type = prop?.type;

    if (type === 'APARTMENT') return propertyId;

    const apartmentId = prop?.apartmentId;
    if (!apartmentId) {
      throw new BadRequestException(
        `Property ${propertyId} is not APARTMENT and has no apartmentId. Set properties.apartmentId on ROOM/BED.`,
      );
    }
    return apartmentId;
  }

  async create(holderId: string, dto: CreatePaymentDto) {
    const col = this.paymentsCollection(holderId);

    const apartmentId =
      dto.apartmentId ??
      (dto.propertyId ? await this.deriveApartmentId(holderId, dto.propertyId) : undefined);

    const data = this.clean({
      ...dto,
      apartmentId,
      status: dto.status ?? 'PLANNED',
      currency: dto.currency ?? 'EUR',
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const ref = await col.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async findAll(holderId: string) {
    const snap = await this.paymentsCollection(holderId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async update(holderId: string, paymentId: string, dto: UpdatePaymentDto) {
    const ref = this.paymentsCollection(holderId).doc(paymentId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Payment ${paymentId} not found`);

    let apartmentId = dto.apartmentId;
    if (!apartmentId && dto.propertyId) {
      apartmentId = await this.deriveApartmentId(holderId, dto.propertyId);
    }

    const data = this.clean({
      ...dto,
      apartmentId,
      updatedAt: new Date(),
    });

    await ref.set(data, { merge: true });
    const updated = await ref.get();
    return { id: updated.id, ...(updated.data() as any) };
  }

  async remove(holderId: string, paymentId: string) {
    const ref = this.paymentsCollection(holderId).doc(paymentId);
    const snap = await ref.get();
    if (!snap.exists) throw new NotFoundException(`Payment ${paymentId} not found`);

    await ref.delete();
    return { success: true };
  }

  // ---- FILES ----
  async addFile(holderId: string, paymentId: string, dto: CreatePaymentFileDto) {
    const paymentRef = this.paymentsCollection(holderId).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) throw new NotFoundException(`Payment ${paymentId} not found`);

    const filesCol = this.paymentFilesCollection(holderId, paymentId);
    const data = this.clean({
      ...dto,
      createdAt: new Date(),
    });

    const ref = await filesCol.add(data);
    const snap = await ref.get();
    return { id: snap.id, ...(snap.data() as any) };
  }

  async listFiles(holderId: string, paymentId: string) {
    const paymentRef = this.paymentsCollection(holderId).doc(paymentId);
    const paymentSnap = await paymentRef.get();
    if (!paymentSnap.exists) throw new NotFoundException(`Payment ${paymentId} not found`);

    const snap = await this.paymentFilesCollection(holderId, paymentId).get();
    return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
  }

  async removeFile(holderId: string, paymentId: string, fileId: string) {
    const filesCol = this.paymentFilesCollection(holderId, paymentId);
    const ref = filesCol.doc(fileId);
    const doc = await ref.get();
    if (!doc.exists) throw new NotFoundException(`File ${fileId} not found`);

    const data = doc.data() as any;
    const storagePath: string | undefined = data?.storagePath ?? data?.path;

    if (storagePath) {
      try {
        const bucket = admin.storage().bucket();
        await bucket.file(storagePath).delete({ ignoreNotFound: true } as any);
      } catch (err) {
        console.error('Errore delete Storage file:', storagePath, (err as any)?.message ?? err);
      }
    }

    await ref.delete();
    return { success: true };
  }
}