
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
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';

import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller('properties')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  private getHolderId(req: any): string {
    const user = req.user as { uid: string; holderId?: string };
    return user.holderId ?? user.uid;
  }

  @Post()
  @Roles('HOLDER')
  create(@Req() req, @Body() dto: CreatePropertyDto) {
    const holderId = this.getHolderId(req);
    return this.propertiesService.create(holderId, dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req) {
    const holderId = this.getHolderId(req);
    return this.propertiesService.findAll(holderId);
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.propertiesService.findOne(holderId, id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    const holderId = this.getHolderId(req);
    return this.propertiesService.update(holderId, id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req, @Param('id') id: string) {
    const holderId = this.getHolderId(req);
    return this.propertiesService.remove(holderId, id);
  }
  
}
