import { Controller, Get } from '@nestjs/common';
import { PROTOCOL_VERSION } from '@echo-front/protocol';
import { SIM_VERSION } from '@echo-front/sim';

@Controller()
export class HealthController {
  @Get('health')
  health(): { status: string; protocol: string; sim: string } {
    return { status: 'ok', protocol: PROTOCOL_VERSION, sim: SIM_VERSION };
  }
}
