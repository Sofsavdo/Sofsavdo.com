import { Module } from "@nestjs/common";
import { ProductsController } from "./products.controller";
import { ProductsService } from "./products.service";
import { ProductsV2Controller } from "./products-v2.controller";
import { ProductsViewService } from "./products-view.service";

@Module({
  controllers: [ProductsController, ProductsV2Controller],
  providers: [ProductsService, ProductsViewService],
  exports: [ProductsService, ProductsViewService],
})
export class ProductsModule {}
