import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as admin from 'firebase-admin';
import { FirebaseService } from '../firebase/firebase.service';
import { UpdatePriceAvailabilityOverrideDto } from './dto/update-price-availability-override.dto';

const OVERRIDE_FIELDS = [
  'prices',
  'monthlyUtilities',
  'deposit',
  'adminFee',
] as const;

type OverrideField = (typeof OVERRIDE_FIELDS)[number];

type UpdateActor = {
  uid: string;
  email?: string;
};

@Injectable()
export class PriceAvailabilityOverridesService {
  constructor(private readonly firebaseService: FirebaseService) {}

  private collection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('priceAvailabilityOverrides');
  }

  private propertiesCollection(holderId: string) {
    return this.firebaseService.firestore
      .collection('holders')
      .doc(holderId)
      .collection('properties');
  }

  async findAll(holderId: string) {
    const snap = await this.collection(holderId).get();

    return snap.docs.map((doc) => ({
      propertyId: doc.id,
      ...(doc.data() as Record<string, unknown>),
    }));
  }

  async update(
    holderId: string,
    propertyId: string,
    dto: UpdatePriceAvailabilityOverrideDto,
    actor: UpdateActor,
  ) {
    const propertySnap = await this.propertiesCollection(holderId)
      .doc(propertyId)
      .get();

    if (!propertySnap.exists) {
      throw new NotFoundException(`Property ${propertyId} not found`);
    }

    const suppliedFields = OVERRIDE_FIELDS.filter(
      (field) => Object.prototype.hasOwnProperty.call(dto, field),
    );

    if (suppliedFields.length === 0) {
      throw new BadRequestException(
        'Specify at least one editable pricing field',
      );
    }

    const updateData: Record<string, unknown> = {
      propertyId,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedByUid: actor.uid,
      updatedByEmail: actor.email ?? null,
    };

    for (const field of suppliedFields) {
      const value = dto[field as OverrideField];

      // null = elimina l'override e torna al valore automatico della view.
      updateData[field] =
        value === null
          ? admin.firestore.FieldValue.delete()
          : value;
    }

    const ref = this.collection(holderId).doc(propertyId);
    await ref.set(updateData, { merge: true });

    const snap = await ref.get();

    return {
      propertyId: snap.id,
      ...(snap.data() as Record<string, unknown>),
    };
  }
}
