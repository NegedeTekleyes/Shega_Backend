import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const smtpPort = process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 587;
    
    // Check if required environment variables are set
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      this.logger.warn('Email configuration incomplete. Real emails will not be sent.');
      this.logger.warn('Set SMTP_HOST, SMTP_USER, and SMTP_PASS environment variables for email functionality.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort, // Now safe - always a number
      secure: smtpPort === 465, // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      // Better timeout handling
      connectionTimeout: 10000, // 10 seconds
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection on startup
    this.verifyConnection().then(success => {
      if (success) {
        this.logger.log('Email transporter initialized successfully');
      } else {
        this.logger.warn(' Email transporter initialization failed - emails will not be sent');
      }
    });
  }

  async sendPasswordResetEmail(email: string, resetToken: string, userName?: string): Promise<boolean> {
    // Use the safe variable name
    const userNameToUse = userName || 'User';
    const resetLink = `http://10.18.52.47:8081/reset-password?token=${resetToken}`;

    // Check if transporter is available
    if (!this.transporter) {
      this.logger.warn(` Email transporter not available. Reset link for ${email}: ${resetLink}`);
      return false;
    }

    const mailOptions = {
      from: `"ShegaReport" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to: email,
      subject: 'Password Reset Request - ShegaReport',
      html: this.getPasswordResetTemplate(userNameToUse, resetLink),
      // Text version for email clients that don't support HTML
      text: this.getPasswordResetText(userNameToUse, resetLink),
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      this.logger.log(`Password reset email sent to: ${email} (Message ID: ${info.messageId})`);
      return true;
    } catch (error) {
      this.logger.error(` Failed to send email to ${email}:`, error.message);
      
      // Fallback: log the reset link for development
      this.logger.warn(` Development fallback - Reset link for ${email}: ${resetLink}`);
      
      // Don't throw error to prevent breaking the password reset flow
      return false;
    }
  }

  private getPasswordResetTemplate(userName: string, resetLink: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset - ShegaReport</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; background: #f5f5f5; }
          .container { max-width: 600px; margin: 0 auto; background: white; }
          .header { background: linear-gradient(135deg, #0a5398, #15bdc6); padding: 30px 20px; text-align: center; color: white; }
          .header h1 { font-size: 28px; margin-bottom: 8px; }
          .header p { font-size: 16px; opacity: 0.9; }
          .content { padding: 40px 30px; }
          .content h2 { color: #0a5398; margin-bottom: 20px; font-size: 24px; }
          .content p { margin-bottom: 16px; font-size: 16px; }
          .button { display: inline-block; padding: 14px 32px; background: #0a5398; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; margin: 20px 0; }
          .button:hover { background: #083d73; }
          .link-box { background: #f8f9fa; padding: 15px; border-radius: 6px; border-left: 4px solid #0a5398; margin: 20px 0; word-break: break-all; font-family: monospace; font-size: 14px; }
          .warning { background: #fff3cd; border: 1px solid #ffeaa7; border-radius: 6px; padding: 15px; margin: 20px 0; color: #856404; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #dee2e6; }
          @media (max-width: 600px) {
            .content { padding: 30px 20px; }
            .header { padding: 25px 15px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>ShegaReport</h1>
            <p>Complaint Management System</p>
          </div>
          
          <div class="content">
            <h2>Password Reset Request</h2>
            
            <p>Hello <strong>${userName}</strong>,</p>
            
            <p>You requested to reset your password for your ShegaReport account. Click the button below to set a new password:</p>
            
            <div style="text-align: center;">
              <a href="${resetLink}" class="button" target="_blank">Reset Your Password</a>
            </div>
            
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            
            <div class="link-box">
              ${resetLink}
            </div>
            
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in 1 hour for security reasons.
            </div>
            
            <p>If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.</p>
            
            <p>Need help? Contact our support team if you have any questions.</p>
            
            <p>Best regards,<br><strong>The ShegaReport Team</strong></p>
          </div>
          
          <div class="footer">
            <p>© ${new Date().getFullYear()} ShegaReport. All rights reserved.</p>
            <p>This is an automated message, please do not reply to this email.</p>
            <p>If you're having trouble with the link above, please contact our support team.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private getPasswordResetText(userName: string, resetLink: string): string {
    return `
Password Reset Request - ShegaReport

Hello ${userName},

You requested to reset your password for your ShegaReport account.

To reset your password, click the following link or copy and paste it into your browser:

${resetLink}

This link will expire in 1 hour for security reasons.

If you didn't request this password reset, please ignore this email. Your account remains secure and no changes have been made.

Need help? Contact our support team if you have any questions.

Best regards,
The ShegaReport Team

---
© ${new Date().getFullYear()} ShegaReport. All rights reserved.
This is an automated message, please do not reply to this email.
    `.trim();
  }

  // Test email connection
  async verifyConnection(): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized');
      return false;
    }

    try {
      await this.transporter.verify();
      this.logger.log(' Email server connection verified successfully');
      return true;
    } catch (error) {
      this.logger.error(' Email server connection failed:', error.message);
      return false;
    }
  }

  // Method to check if email service is available
  isAvailable(): boolean {
    return !!this.transporter;
  }
}