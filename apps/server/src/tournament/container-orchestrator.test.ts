/**
 * O comando `docker` é injetado (`CommandRunner`) justamente para testar a
 * construção dos comandos sem exigir um daemon Docker real no ambiente de
 * CI/teste — ver container-orchestrator.ts para o porquê.
 */
import { describe, expect, it } from 'vitest';
import {
  ContainerOrchestrator,
  DEFAULT_SANDBOX_LIMITS,
  type CommandRunner,
} from './container-orchestrator.js';

class FakeRunner implements CommandRunner {
  calls: { cmd: string; args: string[] }[] = [];
  /** Simula `docker network inspect` falhando (rede ainda não existe) na 1ª chamada. */
  networkExists = false;
  failNextRun = false;

  async run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    this.calls.push({ cmd, args });
    if (args[0] === 'network' && args[1] === 'inspect' && !this.networkExists) {
      throw new Error('no such network');
    }
    if (this.failNextRun) {
      this.failNextRun = false;
      throw new Error('docker: falha simulada');
    }
    return { stdout: '', stderr: '' };
  }
}

describe('ContainerOrchestrator — argumentos de comando', () => {
  it('runArgs aplica os limites do contrato doc-07 (1 vCPU, 512MB, cap-drop ALL, rede isolada)', () => {
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, new FakeRunner());
    const args = orch.runArgs({
      image: 'meu-time/agente:v1',
      containerName: 'echo-agent-meutime-s1',
      wsUrl: 'ws://host.docker.internal:3001/agent',
      agentName: 'meu-time',
    });
    expect(args).toContain('--cpus');
    expect(args[args.indexOf('--cpus') + 1]).toBe('1');
    expect(args).toContain('--memory');
    expect(args[args.indexOf('--memory') + 1]).toBe('512m');
    expect(args).toContain('--network');
    expect(args[args.indexOf('--network') + 1]).toBe('echo-front-tournament');
    expect(args).toContain('--cap-drop');
    expect(args[args.indexOf('--cap-drop') + 1]).toBe('ALL');
    expect(args).toContain('--pids-limit');
    expect(args).not.toContain('--publish'); // sem porta exposta: o agente disca, ninguém disca pra ele
    expect(args.at(-1)).toBe('meu-time/agente:v1');
  });

  it('passa AGENT_WS_URL, AGENT_NAME e (se houver) AGENT_TOKEN via env', () => {
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, new FakeRunner());
    const args = orch.runArgs({
      image: 'img',
      containerName: 'c1',
      wsUrl: 'ws://host.docker.internal:3001/agent',
      agentName: 'trickster-oficial',
      token: 'tok-123',
    });
    const env = args.filter((_, i) => args[i - 1] === '-e');
    expect(env).toContain('AGENT_WS_URL=ws://host.docker.internal:3001/agent');
    expect(env).toContain('AGENT_NAME=trickster-oficial');
    expect(env).toContain('AGENT_TOKEN=tok-123');
  });

  it('omite AGENT_TOKEN quando não fornecido', () => {
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, new FakeRunner());
    const args = orch.runArgs({
      image: 'img',
      containerName: 'c1',
      wsUrl: 'ws://x/agent',
      agentName: 'a',
    });
    expect(args.join(' ')).not.toMatch(/AGENT_TOKEN/);
  });
});

describe('ContainerOrchestrator — ciclo de vida', () => {
  it('ensureNetwork cria a rede --internal só quando ainda não existe', async () => {
    const runner = new FakeRunner();
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, runner);
    await orch.ensureNetwork();
    const createCall = runner.calls.find((c) => c.args[1] === 'create');
    expect(createCall?.args).toContain('--internal');

    runner.calls = [];
    runner.networkExists = true;
    await orch.ensureNetwork();
    expect(runner.calls.some((c) => c.args[1] === 'create')).toBe(false);
  });

  it('start garante a rede antes de subir o container', async () => {
    const runner = new FakeRunner();
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, runner);
    await orch.start({ image: 'img', containerName: 'c1', wsUrl: 'ws://x/agent', agentName: 'a' });
    const kinds = runner.calls.map((c) => c.args[0]);
    expect(kinds.indexOf('network')).toBeLessThan(kinds.indexOf('run'));
  });

  it('stop tenta docker stop e depois rm -f, sem lançar mesmo se o container já sumiu', async () => {
    const runner = new FakeRunner();
    runner.failNextRun = true; // simula 'docker stop' falhando (container já morreu)
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, runner);
    await expect(orch.stop('c1')).resolves.toBeUndefined();
    expect(runner.calls.some((c) => c.args[0] === 'stop')).toBe(true);
    expect(runner.calls.some((c) => c.args[0] === 'rm')).toBe(true);
  });

  it('stopAll para todos os containers em paralelo', async () => {
    const runner = new FakeRunner();
    const orch = new ContainerOrchestrator(DEFAULT_SANDBOX_LIMITS, runner);
    await orch.stopAll(['a', 'b', 'c']);
    const stopped = runner.calls.filter((c) => c.args[0] === 'stop').map((c) => c.args.at(-1));
    expect(stopped.sort()).toEqual(['a', 'b', 'c']);
  });
});
