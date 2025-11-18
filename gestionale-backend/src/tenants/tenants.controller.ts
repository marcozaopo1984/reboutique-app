// src/tenants/tenants.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  Req,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { CreateTenantFileDto } from './dto/create-tenant-file.dto';


@Controller('tenants')
@UseGuards(FirebaseAuthGuard, RolesGuard)   // 👈 PRIMA auth, POI ruoli
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  @Roles('HOLDER')
  create(@Req() req, @Body() dto: CreateTenantDto) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.create(holderId, dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.findAll(holderId);
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req, @Param('id') id: string) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.findOne(holderId, id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdateTenantDto,
  ) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.update(holderId, id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req, @Param('id') id: string) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.remove(holderId, id);
  }
  
  @Post(':id/files')
  @Roles('HOLDER')
  addFile(
    @Req() req,
    @Param('id') tenantId: string,
    @Body() dto: CreateTenantFileDto,
  ) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.addFile(holderId, tenantId, dto);
  }

  @Get(':id/files')
  @Roles('HOLDER')
  listFiles(@Req() req, @Param('id') tenantId: string) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.listFiles(holderId, tenantId);
  }

  @Delete(':tenantId/files/:fileId')
  @Roles('HOLDER')
  removeFile(
    @Req() req,
    @Param('tenantId') tenantId: string,
    @Param('fileId') fileId: string,
  ) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.tenantsService.removeFile(holderId, tenantId, fileId);
  }
}
