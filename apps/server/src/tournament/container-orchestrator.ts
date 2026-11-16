/**
 * Orquestrador de containers para o torneio oficial (sprint-11), conforme o
 * contrato de docs/07-campeonato.md:
 *
 *   "Imagem expõe um processo que conecta ao WS local do orquestrador
 *    (AGENT_WS_URL via env). Limites de referência: 1 vCPU, 512 MB, sem rede
 *    externa, 350 ms por decisão."
 *
 * `350 ms por decisão` é responsabilidade do protocolo/AgentServer (timeout
 * de ciclo), não deste orquestrador — aqui cuidamos do isolamento do
 * PROCESSO: CPU, memória, PIDs, capacidades e rede.
 *
 * O comando `docker` é injetável (`CommandRunner`) para permitir testar a
 * construção dos argumentos sem depender de um daemon Docker real — o
 * padrão default usa `child_process.execFile`.
 */
import { execFile } from 'node:child_process';

export interface SandboxLimits {
  /** Núcleos de CPU (equivalente a `docker run --cpus`). */
  cpus: string;
  /** Memória máxima (`docker run --memory`), ex.: "512m". */
  memory: string;
  /** Teto de processos/threads dentro do container — barra fork-bombs. */
  pidsLimit: number;
  /** Nome da rede Docker isolada (`--internal`: sem rota para a internet). */
  networkName: string;
  /** Prazo para `docker stop` antes de `SIGKILL`. */
  stopTimeoutSec: number;
}

export const DEFAULT_SANDBOX_LIMITS: SandboxLimits = {
  cpus: '1',
  memory: '512m',
  pidsLimit: 128,
  networkName: 'echo-front-tournament',
  stopTimeoutSec: 5,
};

export interface SandboxAgentSpec {
  /** Referência da imagem já construída/publicada pelo competidor. */
  image: string;
  /** Nome único do container (também usado para stop/kill). */
  containerName: string;
  /** URL do WS do orquestrador que o processo dentro do container deve discar. */
  wsUrl: string;
  agentName: string;
  token?: string;
}

export interface CommandRunner {
  run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }>;
}

/** Runner padrão: invoca o binário `docker` do host. */
export class ExecCommandRunner implements CommandRunner {
  run(cmd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      execFile(cmd, args, { timeout: 30_000 }, (err, stdout, stderr) => {
        if (err) reject(new Error(`${cmd} ${args.join(' ')} falhou: ${stderr || err.message}`));
        else resolve({ stdout, stderr });
      });
    });
  }
}

export class ContainerOrchestrator {
  constructor(
    private readonly limits: SandboxLimits = DEFAULT_SANDBOX_LIMITS,
    private readonly runner: CommandRunner = new ExecCommandRunner(),
  ) {}

  /**
   * Cria a rede isolada se ainda não existir. `--internal`: o Docker não
   * instala rota padrão para fora da rede, cumprindo "sem rede externa" do
   * doc 07 — mas isso também tira a rota pro HOST em pelo menos parte das
   * implementações (Docker Engine em Linux não garante `host.docker.internal`
   * numa rede `--internal`). Por isso o `wsUrl` de cada agente deve apontar
   * pra OUTRO CONTAINER nesta mesma rede (ex.: o orquestrador rodando via
   * `apps/server/Dockerfile`, ver `scripts/run-tournament-sandbox.sh`), não
   * pro host — é o único destino que uma rede `--internal` garante alcançável.
   */
  async ensureNetwork(): Promise<void> {
    const inspection = await this.runner
      .run('docker', ['network', 'inspect', '--format', '{{.Internal}}', this.limits.networkName])
      .catch(() => undefined);
    if (inspection) {
      if (inspection.stdout.trim() !== 'true') {
        throw new Error(`Sandbox network "${this.limits.networkName}" must be internal.`);
      }
      return;
    }
    await this.runner.run('docker', this.networkCreateArgs());
  }

  networkCreateArgs(): string[] {
    return ['network', 'create', '--internal', this.limits.networkName];
  }

  /** Argumentos de `docker run` para um agente — expostos para teste/inspeção sem executar. */
  runArgs(spec: SandboxAgentSpec): string[] {
    return [
      'run',
      '--rm',
      '-d',
      '--name',
      spec.containerName,
      '--network',
      this.limits.networkName,
      '--cpus',
      this.limits.cpus,
      '--memory',
      this.limits.memory,
      '--pids-limit',
      String(this.limits.pidsLimit),
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '-e',
      `AGENT_WS_URL=${spec.wsUrl}`,
      '-e',
      `AGENT_NAME=${spec.agentName}`,
      ...(spec.token ? ['-e', `AGENT_TOKEN=${spec.token}`] : []),
      spec.image,
    ];
  }

  /** Sobe o container em background (`-d`); rejeita se `docker run` falhar (imagem ausente, etc). */
  async start(spec: SandboxAgentSpec): Promise<void> {
    await this.ensureNetwork();
    await this.runner.run('docker', this.runArgs(spec));
  }

  /** `docker stop` com timeout configurado, depois `docker rm -f` de segurança (idempotente). */
  async stop(containerName: string): Promise<void> {
    await this.runner
      .run('docker', ['stop', '-t', String(this.limits.stopTimeoutSec), containerName])
      .catch(() => undefined);
    await this.runner.run('docker', ['rm', '-f', containerName]).catch(() => undefined);
  }

  async stopAll(containerNames: string[]): Promise<void> {
    await Promise.all(containerNames.map((n) => this.stop(n)));
  }
}
