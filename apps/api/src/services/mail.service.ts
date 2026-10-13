import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { env } from '../config/env';

@Injectable()
export class MailService {
  private readonly transporter = (() => {
    const config = env(process.env);
    return nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: { user: config.smtpUser, pass: config.smtpPassword },
    });
  })();

  async sendOtp(email: string, code: string, purpose: 'REGISTER' | 'RESET_PASSWORD') {
    const config = env(process.env);
    const action = purpose === 'REGISTER' ? 'xác thực tài khoản' : 'đặt lại mật khẩu';
    await this.transporter.sendMail({
      from: config.smtpFrom,
      to: email,
      subject: 'Mã xác thực OCOP',
      text: `Mã OTP để ${action} OCOP của bạn là ${code}. Mã hết hạn sau 5 phút.`,
    });
  }
}
