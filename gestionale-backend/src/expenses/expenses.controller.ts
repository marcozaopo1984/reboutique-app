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

import { ExpensesService } from './expenses.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { FirebaseAuthGuard } from '../auth/firebase-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('expenses')
@UseGuards(FirebaseAuthGuard, RolesGuard)
export class ExpensesController {
  constructor(private readonly expensesService: ExpensesService) {}

  private getHolderId(req: any) {
    const user = req.user as { uid: string; holderId?: string };
    return user.holderId ?? user.uid;
  }

  @Post()
  @Roles('HOLDER')
  create(@Req() req, @Body() dto: CreateExpenseDto) {
    return this.expensesService.create(this.getHolderId(req), dto);
  }

  @Get()
  @Roles('HOLDER')
  findAll(@Req() req) {
    return this.expensesService.findAll(this.getHolderId(req));
  }

  @Get(':id')
  @Roles('HOLDER')
  findOne(@Req() req, @Param('id') id: string) {
    return this.expensesService.findOne(this.getHolderId(req), id);
  }

  @Patch(':id')
  @Roles('HOLDER')
  update(@Req() req, @Param('id') id: string, @Body() dto: UpdateExpenseDto) {
    return this.expensesService.update(this.getHolderId(req), id, dto);
  }

  @Delete(':id')
  @Roles('HOLDER')
  remove(@Req() req, @Param('id') id: string) {
    return this.expensesService.remove(this.getHolderId(req), id);
  }
}
