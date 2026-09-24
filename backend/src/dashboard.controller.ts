import { Controller, Get, Query } from '@nestjs/common'; import { CoreService } from './core.service';
@Controller('dashboard') export class DashboardController{constructor(private s:CoreService){} @Get() get(){return this.s.dashboard();} @Get('metadata') metadata(@Query('brand') brand?:string){return this.s.metadata(brand);}}
