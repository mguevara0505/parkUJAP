import { PartialType } from '@nestjs/swagger';
import { CreateVisitorDto } from './create-visitor.dto';

/** Todo es editable: los datos del visitante y de su vehículo cambian. */
export class UpdateVisitorDto extends PartialType(CreateVisitorDto) {}
