import { IsEmail, IsOptional, IsString, MaxLength } from 'class-validator'

export class CreateWaitlistDto {
  @IsEmail()
  email: string

  @IsOptional()
  @IsString()
  @MaxLength(50)
  source?: string
}