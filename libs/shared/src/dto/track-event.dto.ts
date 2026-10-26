import {
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
} from 'class-validator';
import { Type } from 'class-transformer';

export class TrackEventDto {
  @IsInt({ message: 'userId должен быть целым числом' })
  @IsPositive({ message: 'userId должен быть больше нуля' })
  @Type(() => Number)
  userId: number;

  @IsString({ message: 'eventName должен быть строкой' })
  @IsNotEmpty({ message: 'eventName не может быть пустым' })
  eventName: string; // Например: 'button_click', 'page_view'

  @IsObject({ message: 'properties должен быть объектом' })
  @IsOptional()
  properties?: Record<string, any>; // Любые доп. данные (например, { buttonId: 'submit_btn' })
}
