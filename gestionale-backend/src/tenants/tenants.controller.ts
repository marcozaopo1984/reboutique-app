import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { CreateTenantFileDto } from './dto/create-tenant-file.dto';

@Controller('tenants')
@UseGuards(FirebaseAuthGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() createTenantDto: CreateTenantDto) {
    return this.tenantsService.create(createTenantDto);
  }

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateTenantDto: UpdateTenantDto) {
    return this.tenantsService.update(id, updateTenantDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.tenantsService.remove(id);
  }

  // -------- FILES endpoints --------

  @Post(':id/files')
  addFile(
    @Param('id') tenantId: string,
    @Body() createFileDto: CreateTenantFileDto,
  ) {
    return this.tenantsService.addFile(tenantId, createFileDto);
  }

  @Get(':id/files')
  listFiles(@Param('id') tenantId: string) {
    return this.tenantsService.listFiles(tenantId);
  }

  @Delete(':id/files/:fileId')
  removeFile(
    @Param('id') tenantId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.tenantsService.removeFile(tenantId, fileId);
  }
}
