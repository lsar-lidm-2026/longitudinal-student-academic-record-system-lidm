/**
 * Mail Utility — Nodemailer Transporter untuk pengiriman email
 * ==============================================================
 *
 * Cara Kerja:
 * 1. Membuat Nodemailer transporter dari konfigurasi SMTP di env.ts.
 * 2. Menyediakan fungsi helper untuk mengirim email spesifik (reset password, dll).
 * 3. Setiap fungsi mencatat log via Pino logger dan mengembalikan boolean sukses/gagal.
 *
 * Alur Lengkap:
 * - Controller panggil sendPasswordResetEmail(to, resetLink) →
 *   Transporter kirim email via SMTP → Log sukses/gagal → Return boolean
 *
 * Dependencies:
 * - nodemailer: Library SMTP email
 * - ./logger: Pino logger untuk logging pengiriman email
 * - ../config/env: Konfigurasi SMTP dari environment variable
 */

import nodemailer from "nodemailer";
import logger from "./logger";
import { env } from "../config/env";

/**
 * Nodemailer transporter — dikonfigurasi dari env SMTP settings.
 * Secure: true jika port 465 (SSL), false untuk port lain (TLS/STARTTLS).
 */
const transporter = nodemailer.createTransport({
  host: env.smtpHost,
  port: env.smtpPort,
  secure: env.smtpPort === 465,
  auth: { user: env.smtpUser, pass: env.smtpPass },
});

/**
 * sendPasswordResetEmail — Mengirim email reset password ke user.
 *
 * Alur:
 * 1. Buat HTML email dengan link reset password.
 * 2. Kirim via Nodemailer transporter.
 * 3. Log hasil pengiriman (sukses/gagal).
 * 4. Return boolean indikator sukses.
 *
 * @param to       - Alamat email tujuan
 * @param resetLink - URL lengkap untuk reset password (termasuk token)
 * @returns Promise<boolean> — true jika terkirim, false jika gagal
 */
export async function sendPasswordResetEmail(to: string, resetLink: string) {
  logger.info({ to }, "Sending password reset email");

  const mailOptions = {
    from: env.smtpFrom,
    to,
    subject: "Reset Password - LSAR System",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">Reset Password LSAR</h2>
        <p>Anda menerima email ini karena ada permintaan reset password untuk akun LSAR Anda.</p>
        <p>Klik tombol di bawah ini untuk mereset password Anda:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}"
             style="background-color: #2563eb; color: white; padding: 12px 32px;
                    border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
            Reset Password
          </a>
        </div>
        <p style="color: #6b7280; font-size: 14px;">
          Link ini akan kedaluwarsa dalam 1 jam.
          Jika Anda tidak meminta reset password, abaikan email ini.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
        <p style="color: #9ca3af; font-size: 12px;">
          LSAR - Longitudinal Student Academic Record
        </p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info({ to }, "Password reset email sent successfully");
    return true;
  } catch (err) {
    logger.error({ err, to }, "Failed to send password reset email");
    return false;
  }
}
