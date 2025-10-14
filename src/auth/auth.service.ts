import {
  Injectable,
  BadRequestException,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { SignupDto } from './dto/signup.dto';
import { LoginDto } from './dto/login.dto';
import { Role } from '@prisma/client';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { EmailService } from 'src/email/email.service';

@Injectable()
export class AuthService {
  private readonly MAX_LOGIN_ATTEMPTS = 5;
  private readonly LOGIN_TIMEOUT_MINUTES = 15;
  private readonly PASSWORD_MIN_LENGTH = 8;

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {}

  // Signup new user with limitations
  async signup(dto: SignupDto) {
    // Validate password strength
    if (dto.password.length < this.PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters long`,
      );
    }

    // Check for common passwords (basic example)
    const commonPasswords = ['password', '12345678', 'qwerty'];
    if (commonPasswords.includes(dto.password.toLowerCase())) {
      throw new BadRequestException('Password is too common');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(dto.email)) {
      throw new BadRequestException('Invalid email format');
    }

    // Rate limiting: Check recent signups from same IP (you'd need to pass IP in DTO)
    // const recentSignups = await this.checkRecentSignups(ipAddress);
    // if (recentSignups > 3) {
    //   throw new BadRequestException('Too many signup attempts. Please try again later.');
    // }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    });

    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 12); // Increased salt rounds

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email.toLowerCase().trim(),
          password: hashedPassword,
          role: dto.role || Role.RESIDENT,
          name: dto.name?.trim(),
          // phone: dto.phone?.trim(),
          // Reset login attempts on signup
          loginAttempts: 0,
          lastLoginAttempt: null,
        },
      });

      // Don't include sensitive information in response
      return this.generateToken(user);
    } catch (error) {
      console.error('Signup error:', error);
      throw new InternalServerErrorException('Failed to create account');
    }
  }

  // Login with security limitations
  async login(dto: LoginDto) {
    // Basic validation
    if (!dto.email || !dto.password) {
      throw new BadRequestException('Email and password are required');
    }

    const normalizedEmail = dto.email.toLowerCase().trim();
    
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // Don't reveal if user exists
      await this.handleFailedLogin(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked due to too many failed attempts
    if (user.loginAttempts >= this.MAX_LOGIN_ATTEMPTS && user.lastLoginAttempt) {
      const timeSinceLastAttempt = new Date().getTime() - user.lastLoginAttempt.getTime();
      const minutesSinceLastAttempt = timeSinceLastAttempt / (1000 * 60);
      
      if (minutesSinceLastAttempt < this.LOGIN_TIMEOUT_MINUTES) {
        throw new UnauthorizedException(
          `Account temporarily locked. Try again in ${Math.ceil(this.LOGIN_TIMEOUT_MINUTES - minutesSinceLastAttempt)} minutes`
        );
      } else {
        // Reset attempts after timeout
        await this.resetLoginAttempts(user.id);
      }
    }

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    
    if (!passwordValid) {
      await this.handleFailedLogin(normalizedEmail);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset login attempts on successful login
    await this.resetLoginAttempts(user.id);

    // Update last login timestamp
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    });

    return this.generateToken(user);
  }

  // Forgot password with limitations
  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const { email } = forgotPasswordDto;
    const normalizedEmail = email.toLowerCase().trim();

    // Rate limiting: Check if too many reset requests
    const recentResetRequests = await this.prisma.passwordResetAttempt.count({
      where: {
        email: normalizedEmail,
        createdAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000), // Last hour
        },
      },
    });

    if (recentResetRequests >= 3) {
      console.log(`Too many reset requests for: ${normalizedEmail}`);
      return; // Silent return for security
    }

    // Record this attempt
    await this.prisma.passwordResetAttempt.create({
      data: {
        email: normalizedEmail,
        ipAddress: 'unknown', // You should pass IP from request
      },
    });

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      // For security, don't reveal if email exists
      console.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
      return;
    }

    // Generate reset token with shorter expiry
    const resetToken = this.jwtService.sign(
      { 
        sub: user.id, 
        email: user.email,
        type: 'password_reset' 
      },
      { 
        expiresIn: '1h' // 1 hour expiry
      }
    );

    // Calculate expiry time
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1);

    // Store reset token in database with expiry
    await this.prisma.user.update({
      where: { id: user.id },
      data: { 
        resetToken,
        resetTokenExpiry,
      },
    });

    // Send email with reset link
    await this.sendResetEmail(user.email, resetToken);

    console.log(`Password reset email sent to: ${normalizedEmail}`);
  }

  // Reset password with security checks
  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    const { token, newPassword } = resetPasswordDto;

    // Validate new password
    if (newPassword.length < this.PASSWORD_MIN_LENGTH) {
      throw new BadRequestException(
        `Password must be at least ${this.PASSWORD_MIN_LENGTH} characters long`
      );
    }

    try {
      // Verify token
      const payload = this.jwtService.verify(token);
      
      if (payload.type !== 'password_reset') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Find user with valid, non-expired token
      const user = await this.prisma.user.findFirst({
        where: {
          id: payload.sub,
          resetToken: token,
          resetTokenExpiry: {
            gt: new Date(), // Check if token hasn't expired
          },
        },
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or expired reset token');
      }

      // Check if new password is different from old password
      const isSamePassword = await bcrypt.compare(newPassword, user.password);
      if (isSamePassword) {
        throw new BadRequestException('New password must be different from current password');
      }

      // Hash new password
      const hashedPassword = await bcrypt.hash(newPassword, 12);

      // Update password and clear reset token
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null,
          loginAttempts: 0, // Reset login attempts
          lastLoginAttempt: null,
          updatedAt: new Date(),
        },
      });

      console.log(`Password reset successful for user: ${user.email}`);
      return { message: 'Password reset successfully' };
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        throw new UnauthorizedException('Reset token has expired');
      }
      if (error.name === 'JsonWebTokenError') {
        throw new UnauthorizedException('Invalid reset token');
      }
      throw error;
    }
  }

  // Private helper methods
  private async handleFailedLogin(email: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user) {
      const newAttempts = (user.loginAttempts || 0) + 1;
      
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          loginAttempts: newAttempts,
          lastLoginAttempt: new Date(),
        },
      });
    }
  }

  private async resetLoginAttempts(userId: number) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lastLoginAttempt: null,
      },
    });
  }

  private async sendResetEmail(email: string, resetToken: string) {
    const resetLink = `http://localhost:8081/reset-password?token=${resetToken}`;
    
    // In development, log to console
    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 Password Reset Link for ${email}: ${resetLink}`);
      return;
    }

    // In production, implement actual email sending
    await this.emailService.sendPasswordResetEmail(email, resetToken);
    console.log(`Reset email would be sent to: ${email}`);
  }

  // Verify token with additional checks
  async verify(token: string) {
    try {
      const payload = await this.jwtService.verifyAsync(token);
      
      // Additional security: Check if user still exists and is active
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          role: true,
          // Add any other non-sensitive fields you need
        },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return { ...payload, role: user.role };
    } catch (err) {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }

  // Helper: Generate JWT with security considerations
  private generateToken(user: any) {
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role 
    };
    
    return {
      access_token: this.jwtService.sign(payload, {
        expiresIn: '7d', // Token expiry 
      }),
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        // Only include non-sensitive information
      },
    };
  }
}