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

@Module({
  imports: [FirebaseModule, TenantsModule, AuthModule, PropertiesModule, LeasesModule, PaymentsModule, ExpensesModule],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}

