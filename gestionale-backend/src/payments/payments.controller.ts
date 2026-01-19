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
import { CreatePaymentFileDto } from './dto/create-payment-file.dto';
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

  // -------------------------
  // FILES
  // -------------------------

  @Get(':id/files')
  @Roles('HOLDER')
  listFiles(@Req() req, @Param('id') paymentId: string) {
    return this.paymentsService.listFiles(this.getHolderId(req), paymentId);
  }

  @Post(':id/files')
  @Roles('HOLDER')
  addFile(@Req() req, @Param('id') paymentId: string, @Body() dto: CreatePaymentFileDto) {
    return this.paymentsService.addFile(this.getHolderId(req), paymentId, dto);
  }

  @Delete(':id/files/:fileId')
  @Roles('HOLDER')
  removeFile(
    @Req() req,
    @Param('id') paymentId: string,
    @Param('fileId') fileId: string,
  ) {
    return this.paymentsService.removeFile(this.getHolderId(req), paymentId, fileId);
  }
}
