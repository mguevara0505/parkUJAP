import { Module } from '@nestjs/common';
import { ParkingSpacesController } from './parking-spaces.controller';
import { ParkingSpacesService } from './parking-spaces.service';
import { SpaceStatusService } from './space-status.service';

@Module({
  controllers: [ParkingSpacesController],
  providers: [ParkingSpacesService, SpaceStatusService],
  exports: [ParkingSpacesService, SpaceStatusService],
})
export class ParkingSpacesModule {}
