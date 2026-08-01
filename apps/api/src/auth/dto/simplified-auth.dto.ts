/**
 * Simplified Auth DTOs
 * 
 * DTOs for the simplified v2 auth API.
 * Phone-only login, 3-step registration, SMS verification.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsPhoneNumber, MinLength, MaxLength } from 'class-validator';

export class SimplifiedRegisterDto {
  @ApiProperty({
    description: 'Display name',
    example: 'Malika'
  })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName!: string;

  @ApiProperty({
    description: 'Phone number',
    example: '+998 90 123 45 67'
  })
  @IsString()
  @IsPhoneNumber('UZ')
  phone!: string;

  @ApiProperty({
    description: 'City',
    example: 'Tashkent',
    required: false
  })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiProperty({
    description: 'Social media link',
    example: 'https://instagram.com/malika',
    required: false
  })
  @IsString()
  @IsOptional()
  socialLink?: string;
}

export class SimplifiedPhoneLoginDto {
  @ApiProperty({
    description: 'Phone number',
    example: '+998 90 123 45 67'
  })
  @IsString()
  @IsPhoneNumber('UZ')
  phone!: string;
}

export class VerifySmsDto {
  @ApiProperty({
    description: 'Phone number',
    example: '+998 90 123 45 67'
  })
  @IsString()
  @IsPhoneNumber('UZ')
  phone!: string;

  @ApiProperty({
    description: 'SMS code',
    example: '123456'
  })
  @IsString()
  @MinLength(4)
  @MaxLength(6)
  code!: string;
}

export class AuthResponseDto {
  @ApiProperty({
    description: 'Access token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  accessToken!: string;

  @ApiProperty({
    description: 'Refresh token',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  })
  @IsString()
  refreshToken!: string;

  @ApiProperty({
    description: 'User ID',
    example: 'clh123abc456def'
  })
  @IsString()
  userId!: string;

  @ApiProperty({
    description: 'Creator profile ID (if creator)',
    example: 'clh789xyz012uvw',
    required: false
  })
  @IsString()
  @IsOptional()
  creatorId?: string;

  @ApiProperty({
    description: 'User role',
    example: 'CREATOR',
    enum: ['CREATOR', 'ADMIN', 'MANAGER']
  })
  @IsString()
  role!: string;
}
