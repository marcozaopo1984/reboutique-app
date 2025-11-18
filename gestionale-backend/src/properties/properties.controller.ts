import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PropertiesService } from './properties.service';
import { CreatePropertyDto } from './dto/create-property.dto';
import { UpdatePropertyDto } from './dto/update-property.dto';
import { SearchPropertiesDto } from './dto/search-property.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';

@Controller()
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class PropertiesController {
  constructor(private readonly propertiesService: PropertiesService) {}

  // CRUD per HOLDER: /properties

  @Post('properties')
  @Roles('HOLDER')
  create(@Req() req, @Body() dto: CreatePropertyDto) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.propertiesService.create(holderId, dto);
  }

  @Get('properties')
  @Roles('HOLDER')
  findAll(@Req() req) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.propertiesService.findAll(holderId);
  }

  @Get('properties/:id')
  @Roles('HOLDER')
  findOne(@Req() req, @Param('id') id: string) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.propertiesService.findOne(holderId, id);
  }

  @Patch('properties/:id')
  @Roles('HOLDER')
  update(
    @Req() req,
    @Param('id') id: string,
    @Body() dto: UpdatePropertyDto,
  ) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.propertiesService.update(holderId, id, dto);
  }

  @Delete('properties/:id')
  @Roles('HOLDER')
  remove(@Req() req, @Param('id') id: string) {
    const user = req.user as { uid: string; holderId?: string };
    const holderId = user.holderId ?? user.uid;
    return this.propertiesService.remove(holderId, id);
  }

  // Endpoint di ricerca per TENANT: /public/properties

  @Get('public/properties')
  @Roles('TENANT')
  searchPublic(@Query() query: SearchPropertiesDto) {
    return this.propertiesService.searchPublic(query);
  }
}
