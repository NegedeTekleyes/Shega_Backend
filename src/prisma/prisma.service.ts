import { Injectable, OnModuleInit, INestApplication } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {

    try {
        await this.$connect();
        console.log('PostgreSQL connected succesfully')
        
    } catch (error) {
       console.error("postgreSQL connection failed:", error) 
    }
  }

  async enableShutdownHooks(app: INestApplication) {
    // Remove beforeExit
    process.on('SIGINT', async () => {
      await this.$disconnect();
      await app.close();
      process.exit(0);
    });
    process.on('SIGTERM', async () => {
      await this.$disconnect();
      await app.close();
      process.exit(0);
    });
  }
}
