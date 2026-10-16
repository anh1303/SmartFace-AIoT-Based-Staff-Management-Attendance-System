import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
import { Logger } from './logger.js';

const emailLogger = new Logger('EmailService');

export interface SendAccountCredentialsOptions {
  to: string;
  fullName: string;
  employeeCode: string;
  rawPassword: string;
  loginUrl?: string;
  subject?: string;
  simulate?: boolean;
}

export interface EmailSendResult {
  success: boolean;
  simulated?: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Gửi email thông báo tài khoản truy cập hệ thống cho nhân viên mới.
 * Tiêu đề thư (Subject) được định dạng chuẩn: [SmartFace AIoT] Thông tin tài khoản truy cập hệ thống - {Họ tên} ({Mã NV})
 * Nếu chưa cấu hình SMTP_USER / SMTP_PASS trong .env hoặc bật cờ simulate, hệ thống sẽ log thông tin ra console
 * để đảm bảo luồng tạo nhân viên không bị gián đoạn hay phát sinh lỗi 500.
 */
export async function sendAccountCredentialsEmail(
  options: SendAccountCredentialsOptions
): Promise<EmailSendResult> {
  const { to, fullName, employeeCode, rawPassword } = options;
  const loginUrl = options.loginUrl || `${env.CLIENT_URL || env.CORS_ORIGIN}/login`;
  
  // Tiêu đề email súc tích, chuyên nghiệp, rõ danh tính và mục đích
  const emailSubject = options.subject || `[SmartFace AIoT] Thông tin tài khoản truy cập hệ thống - ${fullName} (${employeeCode})`;

  const textContent = `============================================================
THÔNG BÁO KHỞI TẠO TÀI KHOẢN TRUY CẬP HỆ THỐNG SMARTFACE AIoT
============================================================

Xin chào ${fullName},

Chào mừng bạn gia nhập đội ngũ của chúng tôi. Tài khoản truy cập hệ thống Quản lý Nhân sự & Chấm công của bạn đã được khởi tạo thành công để phục vụ cho việc theo dõi lịch phân ca, dữ liệu chấm công và bảng lương hàng tháng.

Bạn có thể đăng nhập vào hệ thống tại địa chỉ ${loginUrl} bằng thông tin dưới đây:

Tên đăng nhập: ${employeeCode}
Mật khẩu khởi tạo: ${rawPassword}

Để bảo mật thông tin cá nhân và dữ liệu lương, vui lòng đăng nhập và đổi lại mật khẩu mới ngay trong lần truy cập đầu tiên. Tuyệt đối không chia sẻ mật khẩu này cho bất kỳ ai khác.

Nếu bạn gặp khó khăn trong quá trình đăng nhập hoặc thông tin hồ sơ có sai sót, vui lòng liên hệ bộ phận Nhân sự hoặc Quản trị viên hệ thống để được hỗ trợ kịp thời.

Trân trọng,
Bộ phận Quản trị Hệ thống Nhân sự
SmartFace AIoT Attendance System`;

  const htmlContent = `
<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); padding: 28px 24px; text-align: center; color: #ffffff; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .header p { margin: 6px 0 0; font-size: 13px; opacity: 0.9; }
    .content { padding: 32px 28px; }
    .greeting { font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }
    .credentials-box { background-color: #f1f5f9; border-left: 4px solid #6366f1; padding: 18px 20px; border-radius: 8px; margin: 24px 0; }
    .cred-row { margin: 8px 0; font-size: 15px; display: flex; align-items: center; }
    .cred-label { color: #64748b; font-weight: 500; min-width: 140px; }
    .cred-value { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-weight: 700; color: #1e293b; font-size: 16px; background: #e2e8f0; padding: 3px 10px; border-radius: 6px; letter-spacing: 0.5px; }
    .btn-container { text-align: center; margin: 30px 0; }
    .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff !important; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.3); }
    .warning { font-size: 13px; color: #92400e; background-color: #fef3c7; border: 1px solid #fde68a; padding: 14px 18px; border-radius: 8px; margin-top: 24px; line-height: 1.5; }
    .footer { border-top: 1px solid #e2e8f0; padding: 20px 28px; font-size: 13px; color: #64748b; background-color: #fafafa; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>HỆ THỐNG QUẢN LÝ NHÂN SỰ & CHẤM CÔNG</h1>
      <p>SmartFace AIoT Attendance System</p>
    </div>
    <div class="content">
      <div style="margin-bottom: 22px; padding-bottom: 14px; border-bottom: 1px solid #f1f5f9;">
        <span style="display: inline-block; background-color: #e0e7ff; color: #4338ca; font-size: 11px; font-weight: 700; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px;">
          Thông Báo Chính Thức
        </span>
        <h2 style="margin: 6px 0 0; font-size: 18px; color: #0f172a; font-weight: 700;">
          Khởi tạo tài khoản nhân viên mới
        </h2>
      </div>

      <div class="greeting">Xin chào ${fullName},</div>
      <p>Chào mừng bạn gia nhập đội ngũ của chúng tôi. Tài khoản truy cập hệ thống Quản lý Nhân sự &amp; Chấm công của bạn đã được khởi tạo thành công để phục vụ cho việc theo dõi lịch phân ca, dữ liệu chấm công và bảng lương hàng tháng.</p>
      
      <p>Bạn có thể đăng nhập vào hệ thống tại địa chỉ <a href="${loginUrl}" target="_blank" style="color: #4f46e5; font-weight: 600; text-decoration: underline;">${loginUrl}</a> bằng thông tin dưới đây:</p>

      <div class="credentials-box">
        <div class="cred-row">
          <span class="cred-label">Tên đăng nhập:</span> 
          <span class="cred-value">${employeeCode}</span>
        </div>
        <div class="cred-row">
          <span class="cred-label">Mật khẩu khởi tạo:</span> 
          <span class="cred-value">${rawPassword}</span>
        </div>
      </div>

      <div class="btn-container">
        <a href="${loginUrl}" class="btn" target="_blank">Đăng Nhập Vào Hệ Thống</a>
      </div>

      <div class="warning">
        <strong>⚠️ Lưu ý bảo mật:</strong> Để bảo mật thông tin cá nhân và dữ liệu lương, vui lòng đăng nhập và đổi lại mật khẩu mới ngay trong lần truy cập đầu tiên. Tuyệt đối không chia sẻ mật khẩu này cho bất kỳ ai khác.
      </div>

      <p style="margin-top: 24px; font-size: 14px; color: #475569;">Nếu bạn gặp khó khăn trong quá trình đăng nhập hoặc thông tin hồ sơ có sai sót, vui lòng liên hệ bộ phận Nhân sự hoặc Quản trị viên hệ thống để được hỗ trợ kịp thời.</p>
    </div>
    <div class="footer">
      Trân trọng,<br>
      <strong>Bộ phận Quản trị Hệ thống Nhân sự</strong><br>
      <span style="font-size: 12px; color: #94a3b8;">SmartFace AIoT Attendance System</span>
    </div>
  </div>
</body>
</html>`;

  // Kiểm tra cờ mô phỏng hoặc cấu hình SMTP
  const smtpUser = env.SMTP_USER?.trim();
  const smtpPass = env.SMTP_PASS?.trim();

  if (options.simulate || !smtpUser || !smtpPass) {
    emailLogger.warn(`[Simulated Mode] ${options.simulate ? 'Chế độ test mô phỏng được kích hoạt' : 'Chưa cấu hình SMTP_USER / SMTP_PASS trong .env'}`);
    emailLogger.info(`Mô phỏng gửi email tài khoản: To=${to} (${fullName}), Username=${employeeCode}, Password=${rawPassword}, LoginUrl=${loginUrl}`);
    return { success: true, simulated: true };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: env.SMTP_HOST || 'smtp.gmail.com',
      port: env.SMTP_PORT || 587,
      secure: env.SMTP_SECURE,
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    });

    const info = await transporter.sendMail({
      from: env.SMTP_FROM || `"SmartFace AIoT" <${smtpUser}>`,
      to,
      subject: emailSubject,
      text: textContent,
      html: htmlContent,
    });

    emailLogger.info(`Đã gửi email kích hoạt tài khoản thành công tới ${to} (MessageId: ${info.messageId})`);
    return { success: true, simulated: false, messageId: info.messageId };
  } catch (error: any) {
    emailLogger.error(`Lỗi khi gửi email qua SMTP tới ${to}:`, error?.message || error);
    return { success: false, simulated: false, error: error?.message || 'Lỗi gửi email không xác định' };
  }
}
