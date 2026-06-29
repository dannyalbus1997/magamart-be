import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class QueryProductDto {
  @ApiPropertyOptional() @IsString() @IsOptional() search?: string;
  @ApiPropertyOptional() @IsString() @IsOptional() category?: string;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() minPrice?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(0) @IsOptional() maxPrice?: number;
  @ApiPropertyOptional() @IsString() @IsOptional() sortBy?: string;
  @ApiPropertyOptional({ enum: ['asc', 'desc'] }) @IsIn(['asc', 'desc']) @IsOptional() sortOrder?: 'asc' | 'desc';
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(1) @IsOptional() page?: number;
  @ApiPropertyOptional() @Type(() => Number) @IsNumber() @Min(1) @IsOptional() limit?: number;
}
