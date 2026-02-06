import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeasesService } from './leases.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { RolesGuard } from '../auth/roles.guard';
import { CreateLeaseFileDto } from './dto/create-lease-file.dto';

@Controller('leases')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  private getHolderId(req: any): string {
    const u = req.user as { uid: string; holderId?: string; role?: string };
    return u.holderId ?? u.uid;
  }

  @Post()
  @Roles('HOLDER')
  create(@Req() req: any, @Body() dto: CreateLeaseDto) {
    const holderId = this.getHolderId(req);
    return this.leasesService.create(holderId, dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req: any) {
    const holderId = this.getHolderId(req);
    return this.leasesService.findAll(holderId);
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req: any, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.leasesService.findOne(holderId, id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLeaseDto) {
    const holderId = this.getHolderId(req);
    return this.leasesService.update(holderId, id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req: any, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.leasesService.remove(holderId, id);
  }

  // -------------------------
  // GENERATE SCHEDULE
  // -------------------------

  // ✅ kebab-case (quello "ufficiale")
  @Post(':id/generate-schedule')
  @Roles('HOLDER')
  generateSchedule(@Req() req: any, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.leasesService.generateSchedule(holderId, id);
  }

  // ✅ alias camelCase (per evitare 404 se FE chiama /generateSchedule)
  @Post(':id/generateSchedule')
  @Roles('HOLDER')
  generateScheduleAlias(@Req() req: any, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.leasesService.generateSchedule(holderId, id);
  }

  // -------------------------
  // FILES (documenti)
  // -------------------------

  @Post(':id/files')
  @Roles('HOLDER')
  addFile(@Req() req: any, @Param('id') leaseId: string, @Body() dto: CreateLeaseFileDto) {
    const holderId = this.getHolderId(req);
    return this.leasesService.addFile(holderId, leaseId, dto);
  }

  @Get(':id/files')
  @Roles('HOLDER')
  listFiles(@Req() req: any, @Param('id') leaseId: string) {
    const holderId = this.getHolderId(req);
    return this.leasesService.listFiles(holderId, leaseId);
  }

  @Delete(':id/files/:fileId')
  @Roles('HOLDER')
  removeFile(@Req() req: any, @Param('id') leaseId: string, @Param('fileId') fileId: string) {
    const holderId = this.getHolderId(req);
    return this.leasesService.removeFile(holderId, leaseId, fileId);
  }
}
