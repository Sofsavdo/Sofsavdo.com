import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ProductAiController } from "./product-ai.controller";
import { ProductAiService } from "./product-ai.service";
import { ClaudeProductAiAdapter } from "./claude-product-ai.adapter";
import { PRODUCT_AI_PORT } from "./product-ai.port";

@Module({
  imports: [ConfigModule],
  controllers: [ProductAiController],
  providers: [
    ProductAiService,
    ClaudeProductAiAdapter,
    { provide: PRODUCT_AI_PORT, useFactory: (adapter: ClaudeProductAiAdapter) => adapter, inject: [ClaudeProductAiAdapter] },
  ],
  exports: [ProductAiService],
})
export class ProductAiModule {}
