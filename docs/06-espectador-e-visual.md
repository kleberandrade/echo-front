# 06 — Espectador e Direção Visual

## Direção de arte

Arena isométrica 2,5D escura, como uma **placa eletrônica viva**: plataformas suspensas e blocos translúcidos wireframe, unidades como formas geométricas (tetraedros, prismas, torres hex), trilhas luminosas de movimentação, ondas concêntricas quando um radar dispara, neblina volumétrica sobre regiões desconhecidas, cones/círculos exibindo a percepção dos sensores, sinais falsos piscando e desaparecendo. Paleta: **ciano vs. magenta** sobre grafite quase preto; objetivos em âmbar/dourado. (Referência: concept art `docs/assets/concept-01.png`.)

Hierarquia de leitura para o espectador: 1º objetivo (âmbar), 2º unidades e times (cor), 3º informação sensorial (overlays), 4º ambiente.

## Linguagem visual dos sistemas

| Sistema | Representação |
|---|---|
| Visão | Cone translúcido na cor do time |
| Som | Anéis pulsantes a partir da fonte; espessura = intensidade |
| Radar | Onda circular expansiva + flash no emissor (o preço fica visível) |
| Decoy | Idêntico a uma unidade nos overlays de som/radar; só a visão espectador "onisciente" o marca com contorno tracejado |
| Hide | Unidade vira silhueta fantasma na visão do próprio time; some para o adversário |
| Fog of war | Neblina hex sobre áreas sem leitura recente; esmaece com o tempo desde a última observação |
| Comunicação | Pulso viajando entre aliados; quebrado/vermelho em zona de interferência |
| Fragmento | Cristal âmbar; portador ganha aura âmbar (mais detectável — e o espectador vê por quê) |

## Modos de câmera/visão

1. **Visão geral (onisciente)** — tudo visível, decoys marcados; para entender a partida.
2. **Visão do Time A / Time B** — apenas o que aquele time percebeu: fog real, decoys indistinguíveis, aliados defasados sob interferência. É aqui que o jogo brilha: o espectador sente a incerteza.
3. **Visão de unidade** — percepção crua de uma unidade: leituras de sensores como HUD, painel lateral com `self` (integrity, energy, signature, speed, sensores ativos).
4. **Replay** — timeline com scrubbing, velocidades 0.5×–8×, saltos por evento (event feed clicável).

Alternância entre visões com teclas 1/2/3 e clique em unidade; layout de HUD conforme o concept: placar e cronômetro no topo, event feed à direita, card da unidade selecionada à esquerda, barra de ações na base, minimapa no canto.

## Camada de decisão da IA (o diferencial)

No replay (e ao vivo, com delay opcional), o campo `debug` das decisões vira narrativa:

- Balões/painel: "72% de confiança de que existe um inimigo atrás da torre".
- Setas de intenção: direção decidida vs. direção executada.
- Marcadores de hipótese: onde a IA *acha* que inimigos estão vs. onde estavam de fato (modo onisciente) — o "raio-X do blefe": ver uma IA perseguindo um decoy com 90% de confiança é o momento de ouro do espectador.
- Log de mensagens de time com timestamp, incluindo mensagens perdidas por interferência.

## Event feed

Lista cronológica com ícone + cor do time (como no concept): `04:33 MAGENTA JAMMER deploys decoy echoes`, `04:31 CIAN SCOUT pulse scan`… Cada entrada é clicável → salta a timeline e centraliza a câmera.

## Implementação (PixiJS)

- Camadas (containers): `ground` → `fog` → `objectives` → `trails` → `units` → `sensor-overlays` → `fx` → `ui-anchors`.
- Fog: render texture com furos onde há leitura recente; alpha por idade da informação.
- Ondas/pulsos: shaders simples ou sprites escalados com easing; pooling de partículas.
- Interpolação: o render roda a 60 fps interpolando entre ticks (10/s) — movimento suave sem tocar na simulação.
- Acessibilidade: modo de paleta alternativa (ciano/laranja), tamanhos de fonte do HUD escaláveis.

## Decisões

- 2026-08-25 — Espectador consome o mesmo pacote de percepção dos agentes (para visões por time): garante que "o que o espectador vê como Time A" = exatamente o que o Time A recebeu; zero divergência.
- 2026-08-25 — Concept art aprovado como norte visual; assets finais serão vetoriais/geométricos gerados em código (sem sprites bitmap) para manter o site leve.
