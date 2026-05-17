import { IsUUID, IsString, MaxLength, IsOptional } from 'class-validator'

export class StreamMessageDto {
  @IsUUID() sessionId: string
  @IsString() @MaxLength(2000) message: string
  @IsOptional() @IsString() model?: string  // defaults to 'mortgage-advisor'
  @IsOptional() @IsString() customModelName?: string
  @IsOptional() @IsString() customApiBaseUrl?: string
}