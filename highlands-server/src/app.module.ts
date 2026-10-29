import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HighlandsController } from './highlands.controller';
import { DatabaseService } from './database.service';

@Module({
  imports: [],
  controllers: [AppController, HighlandsController],
  providers: [AppService, DatabaseService],
})
export class AppModule {}
