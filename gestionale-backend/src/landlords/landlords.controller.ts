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
import { LandlordsService } from './landlords.service';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CreateLandlordDto } from './dto/create-landlord.dto';
import { UpdateLandlordDto } from './dto/update-landlord.dto';
import { CreateLandlordFileDto } from './dto/create-landlord-file.dto';

@Controller('landlords')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class LandlordsController {
  constructor(private readonly landlordsService: LandlordsService) {}

  private getHolderId(req: any): string {
    const u = req.user as { uid: string; holderId?: string };
    return u.holderId ?? u.uid;
  }

  // -------------------------
  // CRUD
  // -------------------------

  @Post()
  @Roles('HOLDER')
  create(@Req() req: any, @Body() dto: CreateLandlordDto) {
    return this.landlordsService.create(this.getHolderId(req), dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req: any) {
    return this.landlordsService.findAll(this.getHolderId(req));
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req: any, @Param('id') id: string) {
    return this.landlordsService.findOne(this.getHolderId(req), id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(@Req() req: any, @Param('id') id: string, @Body() dto: UpdateLandlordDto) {
    return this.landlordsService.update(this.getHolderId(req), id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.landlordsService.remove(this.getHolderId(req), id);
  }

  // -------------------------
  // FILES (documenti)
  // -------------------------

  @Post(':id/files')
  @Roles('HOLDER')
  addFile(@Req() req: any, @Param('id') id: string, @Body() dto: CreateLandlordFileDto) {
    return this.landlordsService.addFile(this.getHolderId(req), id, dto);
  }

  @Get(':id/files')
  @Roles('HOLDER')
  listFiles(@Req() req: any, @Param('id') id: string) {
    return this.landlordsService.listFiles(this.getHolderId(req), id);
  }

  @Delete(':id/files/:fileId')
  @Roles('HOLDER')
  removeFile(
    @Req() req: any,
    @Param('id') id: string,
    @Param('fileId') fileId: string,
  ) {
    return this.landlordsService.removeFile(this.getHolderId(req), id, fileId);
  }
}
