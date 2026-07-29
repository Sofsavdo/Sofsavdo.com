import { Module } from "@nestjs/common";
import { SavedProductsController } from "./saved-products.controller";
import { SavedProductsService } from "./saved-products.service";

@Module({
  controllers: [SavedProductsController],
  providers: [SavedProductsService],
})
export class SavedProductsModule {}
