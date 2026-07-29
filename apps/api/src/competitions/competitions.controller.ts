import { Body, Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CompetitionsService } from "./competitions.service";
import { CreateCompetitionDto } from "./dto/create-competition.dto";
import { UpdateCompetitionDto } from "./dto/update-competition.dto";
import { PaginationQueryDto } from "../common/pagination/pagination.dto";
import { RequirePermissions } from "../common/decorators/permissions.decorator";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import type { AuthenticatedUser } from "../common/guards/jwt-auth.guard";

@ApiTags("admin/competitions")
@ApiBearerAuth("bearer")
@Controller("admin/competitions")
export class CompetitionsController {
  constructor(private competitions: CompetitionsService) {}

  @RequirePermissions("competition.read")
  @Get()
  list(@Query() query: PaginationQueryDto) {
    return this.competitions.list(query);
  }

  @RequirePermissions("competition.read")
  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.competitions.findOneOrThrow(id);
  }

  @RequirePermissions("competition.write")
  @Post()
  create(@Body() dto: CreateCompetitionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.create(dto, user.userId);
  }

  @RequirePermissions("competition.write")
  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: UpdateCompetitionDto, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.update(id, dto, user.userId);
  }

  @RequirePermissions("competition.publish")
  @Post(":id/publish")
  publish(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.publish(id, user.userId);
  }

  @RequirePermissions("competition.complete")
  @Post(":id/complete")
  complete(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.complete(id, user.userId);
  }

  @RequirePermissions("competition.archive")
  @Post(":id/archive")
  archive(@Param("id") id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.competitions.archive(id, user.userId);
  }
}
