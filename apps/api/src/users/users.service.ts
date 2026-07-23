import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

// Thin read layer over `User`. Admin CRUD (create staff account, assign roles, suspend) lands in
// Phase 6D per the checkpoint plan (§32) alongside RolesModule's write side — this module only
// backs what auth already needs in 6A.
@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({ where: { id } });
  }
}
