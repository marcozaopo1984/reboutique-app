import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeasesService } from './leases.service';
import { CreateLeaseDto } from './dto/create-lease.dto';
import { UpdateLeaseDto } from './dto/update-lease.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('leases')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class LeasesController {
  constructor(private readonly leasesService: LeasesService) {}

  private getHolderId(req: any): string {
    const user = req.user as { uid: string; holderId?: string };
    return user.holderId ?? user.uid;
  }

  @Post()
  @Roles('HOLDER')
  create(@Req() req, @Body() dto: CreateLeaseDto) {
    return this.leasesService.create(this.getHolderId(req), dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req) {
    return this.leasesService.findAll(this.getHolderId(req));
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req, @Param('id') id: string) {
    return this.leasesService.findOne(this.getHolderId(req), id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateLeaseDto) {
    return this.leasesService.update(this.getHolderId(req), id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req, @Param('id') id: string) {
    return this.leasesService.remove(this.getHolderId(req), id);
  }
}
