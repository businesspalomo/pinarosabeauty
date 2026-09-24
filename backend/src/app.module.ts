import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DatabaseService } from './database.service';
import { HealthController } from './health.controller';
import { DashboardController } from './dashboard.controller';
import { ProductsController } from './products.controller';
import { CustomersController } from './customers.controller';
import { ReceivingController } from './receiving.controller';
import { OrdersController } from './orders.controller';
import { PickingController } from './picking.controller';
import { MovementsController } from './movements.controller';
import { CatalogController } from './catalog.controller';
import { UsersController } from './users.controller';
import { AuthController } from './auth.controller';
import { CoreService } from './core.service';
import { SupabaseAuthGuard } from './supabase-auth.guard';

@Module({
  controllers: [HealthController, DashboardController, ProductsController, CustomersController, ReceivingController, OrdersController, PickingController, MovementsController, CatalogController, UsersController, AuthController],
  providers: [DatabaseService, CoreService, { provide: APP_GUARD, useClass: SupabaseAuthGuard }],
})
export class AppModule {}
