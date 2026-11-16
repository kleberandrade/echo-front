import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  ECHO_DEMO_ENABLED: z.enum(['true', 'false']).default('false'),
  ECHO_WEB_ORIGIN: z
    .string()
    .url()
    .refine((value) => {
      const url = new URL(value);
      return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
    }, 'Expected an HTTP(S) origin without a path or trailing slash')
    .optional(),
});

export function readServerConfig(env: Readonly<Record<string, string | undefined>>) {
  const config = ConfigSchema.parse(env);
  return {
    port: config.PORT,
    demoEnabled: config.ECHO_DEMO_ENABLED === 'true',
    ...(config.ECHO_WEB_ORIGIN ? { webOrigin: config.ECHO_WEB_ORIGIN } : {}),
  };
}
