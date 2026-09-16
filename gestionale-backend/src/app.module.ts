import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { PropertiesModule } from './properties/properties.module';
import { LeasesModule } from './leases/leases.module';
import { PaymentsModule } from './payments/payments.module';
import { ExpensesModule } from './expenses/expenses.module';
import { LandlordsModule } from './landlords/landlords.module';
import { PriceAvailabilityOverridesModule } from './price-availability-overrides/price-availability-overrides.module';


@Module({
  imports: [
    FirebaseModule,
    TenantsModule,
    AuthModule,
    PropertiesModule,
    LeasesModule,
    PaymentsModule,
    ExpensesModule,
    LandlordsModule,
    PriceAvailabilityOverridesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}

