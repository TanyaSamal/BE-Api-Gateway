import { IsInt, IsOptional, IsPositive, IsIn, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAnalyticsDashboardDto {
  @IsInt({ message: 'userId должен быть целым числом' })
  @IsPositive({ message: 'userId должен быть больше нуля' })
  @Type(() => Number) // Преобразует строку из Query-параметров в число
  userId: number;

  @IsOptional()
  @IsString({ message: 'period должен быть строкой' })
  @IsIn(['7_days', '30_days'], {
    message: 'period может быть только 7_days или 30_days',
  })
  period?: string = '7_days';
}
