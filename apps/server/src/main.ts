import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module.js';
import { readServerConfig } from './config.js';
import { startDemoAgents } from './demo-agents.js';

async function bootstrap(): Promise<void> {
  const config = readServerConfig(process.env);
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  app.enableCors({ origin: config.webOrigin ?? true });
  app.enableShutdownHooks();
  const port = config.port;
  await app.listen(port, '0.0.0.0');
  if (config.demoEnabled) {
    const stopDemo = startDemoAgents(`ws://127.0.0.1:${port}/agent`);
    process.once('SIGTERM', stopDemo);
    process.once('SIGINT', stopDemo);
    console.log('[echo-front] continuous reference-agent demo enabled');
  }
  // eslint-disable-next-line no-console
  console.log(`[echo-front] server on :${port} — WS em /agent, health em /health`);
}

void bootstrap().catch((error: unknown) => {
  console.error('[echo-front] startup failed:', error);
  process.exitCode = 1;
});
