import { Module } from '@nestjs/common';
import { FirebaseModule } from '../firebase/firebase.module';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { PriceAvailabilityOverridesController } from './price-availability-overrides.controller';
import { PriceAvailabilityOverridesService } from './price-availability-overrides.service';

@Module({
  imports: [FirebaseModule],
  controllers: [PriceAvailabilityOverridesController],
  providers: [PriceAvailabilityOverridesService, FirebaseAuthGuard],
})
export class PriceAvailabilityOverridesModule {}
