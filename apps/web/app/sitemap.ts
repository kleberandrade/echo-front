import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://echo-front.vercel.app';

// Só as rotas estáticas — /replay/[id] é dinâmica e por natureza efêmera
// (um replay por partida disputada), não vale a pena listar uma por uma
// aqui; o buscador chega nelas por link a partir de /matches.
const ROUTES = ['', '/compete', '/leaderboard', '/matches', '/watch/demo'];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
  }));
}
