# 02 — Game Design

## Loop central

1. O simulador avança em **ticks** (10 ticks/s no MVP).
2. A cada **ciclo de decisão** (a cada 5 ticks, ou seja, 2 decisões/s), cada agente recebe um pacote de **percepção** e responde com uma **decisão** (movimento + no máximo 1 ação especial + mensagem opcional ao time).
3. O simulador é **autoritativo**: valida, aplica custos de energia e resolve conflitos. Decisões inválidas ou atrasadas viram no-op (a unidade mantém o comportamento anterior).
4. Vence quem cumprir o objetivo do modo antes do tempo acabar (ou por pontuação/tiebreak).

## Arena

- Grade contínua sobre células hexagonais/quadradas (MVP: grade quadrada 64×36 unidades lógicas), com plataformas em 2–3 alturas.
- Elementos: **plataformas**, **obstáculos** (bloqueiam visão e movimento), **torres de energia** (recarga lenta em raio curto), **zonas de interferência** (comunicação e radar degradados), **spawns de fragmento**, **núcleo** de cada time.
- Mapa simétrico por rotação de 180° para equilíbrio competitivo.

## Recursos

| Recurso | Escopo | Regeneração | Consumido por |
|---|---|---|---|
| **Integrity** (vida) | por unidade | não regenera (MVP) | dano, colisões |
| **Energy** | por unidade | +2/ciclo (até o máx.); +6/ciclo em torre de energia | movimento rápido, ações especiais, radar |
| **Informação** | implícito | — | percepção; "gasto" ao revelar-se |

## Sensores

Todo sensor tem uma vantagem e uma desvantagem — este é o coração do jogo.

| Sensor | Vantagem | Desvantagem | Saída típica |
|---|---|---|---|
| **Visão** | Identificação precisa (tipo + distância) | Bloqueada por obstáculos; cone limitado (90°, alcance 14) | `{type, direction, distance}` |
| **Térmico** (pós-MVP) | Detecta unidades escondidas/camufladas | Confunde máquinas, torres e rastros residuais | `{intensity, direction}` sem tipo |
| **Som** | Grande alcance (30), atravessa obstáculos | Direção imprecisa (±25°), sem distância confiável | `{intensity, direction±ruído}` |
| **Radar ativo** (`pulse_scan`) | Revela todas as entidades num raio de 18 por 1 ciclo | Custa 25 de energia e **anuncia a posição do emissor para todos** | snapshot com posições aproximadas |
| **Comunicação** | Compartilha informação com o time (campo `message_to_team`) | Bloqueada em zonas de interferência; interceptável pelo Disruptor (pós-MVP) | mensagens de até 64 bytes |

Ruído: direções e intensidades recebem jitter determinístico derivado da semente da partida — reproduzível, mas não trivialmente invertível pelo agente.

### As decisões que os sensores forçam

O agente precisa constantemente escolher: confiar ou não em uma leitura; pagar energia (e exposição) por informação melhor; tratar um sinal como inimigo ou como isca; compartilhar ou guardar o que sabe; defender o objetivo ou preparar emboscada; economizar energia ou agir agressivamente.

## Unidades (classes)

MVP usa **Observer + Runner**. As demais entram nas sprints pós-MVP.

| Classe | Papel | Atributos | Habilidades |
|---|---|---|---|
| **Observer** | Sensor ambulante | Integrity baixa, energia alta, velocidade média | Cone de visão ampliado, `pulse_scan` com custo reduzido |
| **Runner** | Transporte de fragmentos | Integrity média, muito rápido, assinatura baixa | `speed_boost`, `hide` (reduz assinatura a ~0 por 3 ciclos, imóvel) |
| **Warden** | Defesa de área | Integrity alta, lento | `shield_wall` (parede temporária), zona defensiva |
| **Phantom** | Guerra de informação | Frágil, rápido | Camuflagem ativa, `deploy_decoy` (eco falso com assinatura configurável) |
| **Disruptor** | Negação de sensores | Médio | Jamming de comunicação, falso-positivo em radar inimigo |
| **Architect** | Infraestrutura | Lento, caro | Constrói torres-sensores fixas, pontes, mini-torres de energia |

Composição: cada time monta 3–4 unidades. Desafios de torneio podem restringir ("vença escolhendo apenas 3 das 6 classes") ou espelhar composições ("mesmas unidades; vence a melhor estratégia").

## Ações especiais (MVP)

| Ação | Custo | Efeito | Contrapartida |
|---|---|---|---|
| `pulse_scan` | 25 (Observer: 15) | Revela entidades num raio 18 por 1 ciclo | Emissor aparece no event feed global e nos sensores inimigos |
| `deploy_decoy` | 20 | Cria eco em `target` que emite som/assinatura de radar por 10 ciclos | Decoy some se "visto" por visão direta |
| `hide` | 10 + imobilidade | Assinatura ~0 por 3 ciclos | Não se move nem sente por visão enquanto oculto |
| `speed_boost` (Runner) | 3/ciclo | Velocidade ×1,6 | Assinatura sonora alta enquanto ativo |

Regra geral: **toda ação que melhora sua situação informacional ou posicional vaza informação em troca.**

## Fragmentos e captura (modo Data Run)

- Fragmentos surgem em pontos fixos do mapa (semente define ordem/timing dentro de um conjunto conhecido).
- Capturar: permanecer 2 ciclos adjacente ao fragmento sem inimigo no mesmo raio.
- Transportar: `carrying_fragment: true` reduz velocidade em 20% e aumenta assinatura térmica/sonora — o portador fica mais detectável.
- Entregar: tocar o próprio núcleo. Se o portador for destruído, o fragmento cai no local.

## Combate

Combate existe, mas é caro e secundário. Ataque básico: `strike` em alvo adjacente-curto (alcance 3), custo 15 de energia, dano 20 de integrity, gera assinatura alta. Destruir unidades pontua pouco; o incentivo dominante é o objetivo.

## Modos de disputa

| Modo | Objetivo | Twist |
|---|---|---|
| **Data Run** (MVP) | Capturar e entregar fragmentos | Portador fica mais detectável |
| **Core Siege** | Localizar e destruir o núcleo adversário | Núcleo só aparece em sensores a curta distância |
| **Signal Control** | Dominar torres de comunicação | Torres dominadas ampliam seus sensores |
| **Silent Hunt** | Data Run com sensores ativos limitados | Nº de `pulse_scan` por partida é finito |
| **Energy Crisis** | Qualquer objetivo com pool de energia único do time | Cada ação de um drena todos |
| **Mutation** | Mapa muda durante a partida | Pontes caem, zonas de interferência migram |
| **Escort** | Proteger entidade autônoma que segue rota própria | Não se controla a escolta, só o ambiente dela |

## Condições de vitória e pontuação (Data Run MVP)

1. Primeiro time a entregar 3 fragmentos vence.
2. Ao fim dos 90 s: mais fragmentos entregues → mais fragmentos carregados → mais integrity total → empate resolvido por menor energia total consumida.

## Decisões

- 2026-08-25 — Grade quadrada no MVP (hex fica para depois): simplifica pathfinding e o modelo de oclusão da visão.
- 2026-08-25 — 2 decisões/s por agente: suficiente para tática, generoso para agentes remotos com latência de rede; timeout de decisão = 350 ms.
- 2026-08-25 — Combate mantido no MVP, mas caro: preserva a tensão sem transformar o jogo em deathmatch.
