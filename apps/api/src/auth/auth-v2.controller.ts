/**
 * Simplified Auth Controller
 * 
 * Controller for the simplified v2 auth API.
 * Phone-only login, 3-step registration, SMS verification.
 */

import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthV2Service } from './auth-v2.service';
import {
  SimplifiedRegisterDto,
  SimplifiedPhoneLoginDto,
  VerifySmsDto,
  AuthResponseDto,
} from './dto/simplified-auth.dto';

@ApiTags('Auth V2')
@Controller('v2/auth')
export class AuthV2Controller {
  constructor(private readonly authV2Service: AuthV2Service) {}

  @Post('register')
  @ApiOperation({ summary: 'Simplified registration - 3 steps only' })
  @ApiResponse({ status: 201, description: 'Registration successful', type: AuthResponseDto })
  async register(@Body() dto: SimplifiedRegisterDto): Promise<AuthResponseDto> {
    return this.authV2Service.register(dto);
  }

  @Post('login/phone')
  @ApiOperation({ summary: 'Phone-only login' })
  @ApiResponse({ status: 200, description: 'SMS code sent' })
  async phoneLogin(@Body() dto: SimplifiedPhoneLoginDto): Promise<{ message: string }> {
    return this.authV2Service.phoneLogin(dto);
  }

  @Post('verify-sms')
  @ApiOperation({ summary: 'Verify SMS code and complete login' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponseDto })
  async verifySms(@Body() dto: VerifySmsDto): Promise<AuthResponseDto> {
    return this.authV2Service.verifySms(dto);
  }
}
