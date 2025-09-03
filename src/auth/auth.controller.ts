import {
  Body,
  Controller,
  Post,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { VerifyDto } from './dto/verify.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // 🔑 Signup
  @Post('signup')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async signup(@Body() signupDto: SignupDto) {
    return this.authService.signup(signupDto);
  }

  // 🔑 Login
  @Post('login')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  // 🔑 Verify JWT
  @Post('verify')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async verify(@Body() verifyDto: VerifyDto) {
    return this.authService.verify(verifyDto.token);
  }
}
