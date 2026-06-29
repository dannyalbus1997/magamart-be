import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health-check')
export class HealthController {
  @Get('view')
  @ApiOperation({ summary: 'Health check' })
  check() {
    return {
      message: 'Server is healthy',
      data: { status: 'ok', timestamp: new Date().toISOString() },
    };
  }
}
