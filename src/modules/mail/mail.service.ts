import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailClient } from '@azure/communication-email';
import * as ejs from 'ejs';
import { join } from 'path';
import { existsSync } from 'fs';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly emailClient: EmailClient | null;
  private readonly senderAddress: string;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.get<string>('acs.connectionString');
    this.senderAddress =
      this.config.get<string>('acs.senderAddress') || 'DoNotReply@megamart.com';

    if (connectionString) {
      this.emailClient = new EmailClient(connectionString);
    } else {
      this.emailClient = null;
      this.logger.warn(
        'ACS_CONNECTION_STRING not set - order confirmation emails will be skipped.',
      );
    }
  }

  private resolveTemplatePath(name: string): string {
    const distPath = join(
      __dirname,
      '..',
      '..',
      'assets',
      'email-templates',
      `${name}.ejs`,
    );
    const srcPath = join(
      process.cwd(),
      'src',
      'assets',
      'email-templates',
      `${name}.ejs`,
    );
    return existsSync(distPath) ? distPath : srcPath;
  }

  async sendOrderConfirmation(
    to: string,
    data: { userName: string; order: any },
  ): Promise<void> {
    const templatePath = this.resolveTemplatePath('order-confirmation');

    let html: string;
    try {
      html = await ejs.renderFile(templatePath, data);
    } catch (err) {
      this.logger.error('Failed to render order-confirmation template', err);
      return;
    }

    const orderId = data.order?.id?.slice(-8).toUpperCase() ?? 'N/A';

    if (!this.emailClient) {
      this.logger.warn(
        `Email not sent (no ACS client) - would have sent to ${to}`,
      );
      return;
    }

    try {
      const poller = await this.emailClient.beginSend({
        senderAddress: this.senderAddress,
        content: {
          subject: `Order Confirmed - #${orderId}`,
          html,
        },
        recipients: {
          to: [{ address: to }],
        },
      });
      await poller.pollUntilDone();
      this.logger.log(`Order confirmation sent to ${to}`);
    } catch (err) {
      this.logger.error(`Failed to send order confirmation to ${to}`, err);
    }
  }
}
