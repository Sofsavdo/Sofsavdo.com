import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { AdminPaymentsService } from "./admin-payments.service";
import { PaymentQueryDto } from "./dto/payment-query.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";

@ApiTags("admin/payments")
@ApiBearerAuth("bearer")
@Controller("admin/payments")
export class AdminPaymentsController {
  constructor(private payments: AdminPaymentsService) {}

  @RequirePermissions("payment.read")
  @Get()
  list(@Query() query: PaymentQueryDto) {
    return this.payments.list(query);
  }

  @RequirePermissions("payment.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.payments.findOneOrThrow(id);
  }

  @RequirePermissions("payment.read")
  @Get(":id/timeline")
  timeline(@Param("id") id: string) {
    return this.payments.getTimeline(id);
  }
}
