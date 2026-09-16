import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { UpdatePriceAvailabilityOverrideDto } from './dto/update-price-availability-override.dto';
import { PriceAvailabilityOverridesService } from './price-availability-overrides.service';

@Controller('price-availability-overrides')
@UseGuards(FirebaseAuthGuard)
export class PriceAvailabilityOverridesController {
  constructor(
    private readonly priceAvailabilityOverridesService: PriceAvailabilityOverridesService,
  ) {}

  private getHolderId(req: any): string {
    const user = req.user as { uid: string; holderId?: string };
    return user.holderId ?? user.uid;
  }

  @Get()
  findAll(@Req() req: any) {
    return this.priceAvailabilityOverridesService.findAll(
      this.getHolderId(req),
    );
  }

  @Patch(':propertyId')
  update(
    @Req() req: any,
    @Param('propertyId') propertyId: string,
    @Body() dto: UpdatePriceAvailabilityOverrideDto,
  ) {
    const user = req.user as {
      uid: string;
      email?: string;
    };

    return this.priceAvailabilityOverridesService.update(
      this.getHolderId(req),
      propertyId,
      dto,
      {
        uid: user.uid,
        email: user.email,
      },
    );
  }
}
