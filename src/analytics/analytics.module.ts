import { Module } from "@nestjs/common";
import { PrismaModule } from "src/prisma/prisma.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsService } from "./analytics.service";
import { AuthModule } from "src/auth/auth.module";


@Module({
    imports: [PrismaModule, AuthModule],
    controllers: [AnalyticsController],
    providers: [AnalyticsService],
    exports: [AnalyticsService],
})
export class AnalyticsModule {}