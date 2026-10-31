import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { OTP_TTL_MS } from '../constants/auth';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter?: ReturnType<typeof nodemailer.createTransport>;

  private getTransporter() {
    if (!this.transporter) {
      const config = env(process.env);
      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: config.smtpPort === 465,
        auth: { user: config.smtpUser, pass: config.smtpPassword },
      });
    }
    return this.transporter;
  }

  async sendOtp(email: string, code: string, purpose: 'REGISTER' | 'RESET_PASSWORD' | 'GOOGLE_LINK') {
    const config = env(process.env);
    if (config.smtpHost === 'smtp.example.com' && process.env.NODE_ENV !== 'production') {
      // shortcut: skip delivery with placeholder SMTP in development; configure real SMTP to receive codes.
      this.logger.log(`[DEV OTP] ${purpose} delivery skipped for ${email}`);
      return;
    }
    const action = purpose === 'REGISTER' ? 'xác thực tài khoản' : purpose === 'GOOGLE_LINK' ? 'liên kết tài khoản Google với tài khoản' : 'đặt lại mật khẩu';
    await this.getTransporter().sendMail({
      from: config.smtpFrom,
      to: email,
      subject: 'Mã xác thực OCOP',
      text: `Mã OTP để ${action} OCOP của bạn là ${code}. Mã hết hạn sau ${OTP_TTL_MS / 60_000} phút.`,
    });
  }
}
