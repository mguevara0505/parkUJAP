import { Module } from '@nestjs/common';
import { ParkingSpacesController } from './parking-spaces.controller';
import { ParkingSpacesService } from './parking-spaces.service';

@Module({
  controllers: [ParkingSpacesController],
  providers: [ParkingSpacesService],
  exports: [ParkingSpacesService],
})
export class ParkingSpacesModule {}
