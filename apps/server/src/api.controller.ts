import { Controller, Get, NotFoundException, Param, Post, Body, BadRequestException, Header } from '@nestjs/common';
import { agentServer } from './match/agent-server.js';

/**
 * API pública (sprint-06): resultados, replays verificáveis e leaderboard.
 */
@Controller('api')
export class ApiController {
  @Get('leaderboard')
  leaderboard() {
    return { standings: agentServer.store?.standings() ?? [] };
  }

  @Get('matches')
  matches() {
    return { matches: agentServer.store?.listResults() ?? [] };
  }

  @Get('matches/:id/replay')
  @Header('content-type', 'application/x-ndjson')
  replay(@Param('id') id: string): string {
    const jsonl = agentServer.store?.readReplay(id);
    if (!jsonl) throw new NotFoundException(`replay ${id} não encontrado`);
    return jsonl;
  }

  @Post('agents')
  register(@Body() body: { name?: string }) {
    const name = body?.name?.trim();
    if (!name || name.length < 2 || name.length > 48) {
      throw new BadRequestException('name obrigatório (2–48 caracteres)');
    }
    if (!agentServer.store) throw new BadRequestException('persistência desativada');
    const agent = agentServer.store.registerAgent(name);
    return { name: agent.name, token: agent.token };
  }
}
