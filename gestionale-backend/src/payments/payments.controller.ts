import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('payments')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  private getHolderId(req: any) {
    const user = req.user as { uid: string; holderId?: string };
    return user.holderId ?? user.uid;
  }

  @Post()
  @Roles('HOLDER')
  create(@Req() req, @Body() dto: CreatePaymentDto) {
    return this.paymentsService.create(this.getHolderId(req), dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req) {
    return this.paymentsService.findAll(this.getHolderId(req));
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdatePaymentDto) {
    return this.paymentsService.update(this.getHolderId(req), id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req, @Param('id') id: string) {
    return this.paymentsService.remove(this.getHolderId(req), id);
  }
}
