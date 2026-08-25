import { Module } from '@nestjs/common';
import { ApiController } from './api.controller.js';
import { HealthController } from './health.controller.js';
import { AgentGateway } from './match/agent.gateway.js';
import { SpectatorGateway } from './match/spectator.gateway.js';

@Module({
  controllers: [HealthController, ApiController],
  providers: [AgentGateway, SpectatorGateway],
})
export class AppModule {}
