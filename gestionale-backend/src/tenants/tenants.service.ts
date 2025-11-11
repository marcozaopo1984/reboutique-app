import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { FirebaseService } from './../firebase/firebase.service';

export interface Tenant {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
}

@Injectable()
export class TenantsService {
  private readonly collectionName = 'tenants';

  constructor(private readonly firebaseService: FirebaseService) {}

  private get collection() {
    return this.firebaseService.firestore.collection(this.collectionName);
  }

  async create(createTenantDto: CreateTenantDto): Promise<Tenant> {
    // Crea un nuovo documento in Firestore con i dati del DTO
    const docRef = await this.collection.add({
      ...createTenantDto,
    });

    const doc = await docRef.get();
    return {
      id: doc.id,
      ...(doc.data() as Omit<Tenant, 'id'>),
    };
  }

  async findAll(): Promise<Tenant[]> {
    const snapshot = await this.collection.get();
    return snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<Tenant, 'id'>),
    }));
  }

  async findOne(id: string): Promise<Tenant> {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }

    return {
      id: doc.id,
      ...(doc.data() as Omit<Tenant, 'id'>),
    };
  }

  async update(id: string, updateTenantDto: UpdateTenantDto): Promise<Tenant> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }

    // Usiamo set(..., { merge: true }) per fare un "partial update"
    await docRef.set(
      {
        ...updateTenantDto,
      },
      { merge: true },
    );

    const updated = await docRef.get();
    return {
      id: updated.id,
      ...(updated.data() as Omit<Tenant, 'id'>),
    };
  }

  async remove(id: string): Promise<void> {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      throw new NotFoundException(`Tenant with id ${id} not found`);
    }

    await docRef.delete();
  }
}
