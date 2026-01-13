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

@Controller('landlords')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class LandlordsController {
  constructor(private readonly landlordsService: LandlordsService) {}

  private getHolderId(req: any): string {
    const u = req.user as { uid: string; holderId?: string };
    return u.holderId ?? u.uid;
  }

  @Post()
  @Roles('HOLDER')
  create(@Req() req: any, @Body() dto: CreateLandlordDto) {
    const holderId = this.getHolderId(req);
    return this.landlordsService.create(holderId, dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req: any) {
    const holderId = this.getHolderId(req);
    return this.landlordsService.findAll(holderId);
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req: any, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.landlordsService.findOne(holderId, id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateLandlordDto,
  ) {
    const holderId = this.getHolderId(req);
    return this.landlordsService.update(holderId, id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req: any, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.landlordsService.remove(holderId, id);
  }
}
