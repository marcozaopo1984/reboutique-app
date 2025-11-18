import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantsModule } from './tenants/tenants.module';
import { FirebaseModule } from './firebase/firebase.module';
import { AuthModule } from './auth/auth.module';
import { PropertiesModule } from './properties/properties.module';

@Module({
  imports: [FirebaseModule, TenantsModule, AuthModule, PropertiesModule],
  controllers: [AppController],
  providers: [AppService],
})

export class AppModule {}

