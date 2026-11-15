# ARES · GALE: mapa de EVA para o Monte Sharp

NASA Space Apps · desafio **"Guia de Sobrevivência Interplanetária: Mapa de Marte"**

Este é um aplicativo para tablet, com um modo HUD de capacete, que uma tripulação usa para **planejar e executar caminhadas (EVAs) em Marte**. O local é a cratera Gale, nas encostas do Monte Sharp, exatamente por onde o rover Curiosity passou entre 2024 e 2025.

## Como abrir

Ao abrir sem parâmetros, aparece a **tela de abertura** (pitch), que pode ser reaberta pelo botão "ⓘ Missão". Os números dela são calculados ao vivo a partir dos dados. Para forçá-la junto com outros parâmetros, use `#intro=1`.


Abra o `index.html` no navegador. Não precisa de servidor nem de instalação.
Os mapas vêm do serviço de tiles do NASA Mars Trek, então é preciso estar conectado à internet. As fotos e o OpenLayers têm cópia local.

Atalhos de demonstração pela URL:

| URL | Efeito |
|---|---|
| `index.html#eva=2` | Abre a EVA-2 (boxwork) |
| `#t=11.2` | Posiciona a linha do tempo às 11h12 LMST |
| `#stop=2` | Abre o detalhe da parada 2 (índice a partir de 0) |
| `#hud=1` | Abre o modo HUD |
| `#sep=1` | Simula o evento de partículas solares de mai/2024 |
| `#layers=dem,themis,mola,slope` | Liga camadas extras |
| `#route=safe&limit=12` | Usa a rota segura A* com limite de 12° |

## Missão

| | EVA-1 · Canal Gediz Vallis | EVA-2 · Rede de boxwork |
|---|---|---|
| Objetivo | Depósitos de detritos do canal e o campo de **enxofre elementar** (primeira detecção em Marte, sol 4200) | Cristas de **boxwork**: minerais de água subterrânea em fraturas |
| Distância | ~0,9 km | ~1,1 km |
| Duração | ~4h15 | ~4h05 |

A rota segue as **posições reais do Curiosity**. Isso garante que o terreno já foi atravessado com sucesso e que existe foto de solo em cada ponto.

## Camadas e tipos de dados

| Tipo | Dado | Fonte |
|---|---|---|
| Óptico | HiRISE (~25 cm/px), CTX (~6 m/px), Viking | MRO / Viking via Mars Trek |
| Topográfico | **Mapa de inclinação real** calculado do DEM HiRISE 1 m de Gale (grade de 4 m), DEM recolorido, MOLA+HRSC sombreado, elevação e inclinação medidas pelo rover | USGS Astrogeology / equipe MSL, Mars Trek, NASA/JPL MMGIS |
| Térmico | THEMIS IR noturno 100 m: rocha (clara) × areia/poeira (escura) | Mars Odyssey via Mars Trek |
| Radiação | Dose GCR de 0,64 mSv/sol; evento SEP de 20/mai/2024 (8,1 mGy) | Curiosity RAD (Hassler et al. 2014; NASA 2024) |
| Atmosférico | Temperatura do ar e do solo, pressão, vento, UV, luz restante | Modelo diurno calibrado por faixas do REMS |
| Imagens de superfície | Navcam em cada parada (horizonte e solo) | Curiosity raw images API |

## Navegação estilo Google Maps

- **Busca de lugares** (barra no topo do mapa): paradas das EVAs, zonas científicas, os 1.783 nomes oficiais da IAU para Marte, posição do Curiosity em qualquer sol (`sol 4200`) e coordenadas (`-4.78 137.40` ou `4.78S 137.40E`). Clicar num resultado abre o **cartão do lugar**, com elevação, inclinação, distância da tripulação e ações.
- **Rotas A→B** (botão ◆): origem e destino por busca, clique no mapa, posição da tripulação ou rover. São geradas até 3 alternativas: *mais segura* (≤ 12°), *recomendada* (≤ 15°) e *mais rápida* (≤ 20°). "Iniciar navegação" cria a aba **Rota livre**, e linha do tempo, alertas e HUD passam a seguir essa rota. Rotas a pé só funcionam dentro da área do DEM (~3 × 4 km).
- **Passo a passo**: instruções como "Vire à direita e siga 120 m rumo SO · subida de 8 m · até 13°", com a etapa atual destacada. O HUD mostra a próxima manobra e a distância até ela.
- **"Street View" marciano** (botão 📷): o trajeto do Curiosity fica azul. Clicar em qualquer um dos 1.389 pontos (2012–2026) abre as fotos Navcam tiradas ali, com navegação entre fotos (← →) e entre paradas (↑ ↓ ou botões). As fotos vêm ao vivo da API de imagens brutas da NASA. Sem rede, o app usa as cópias locais das paradas das EVAs.

## Rota segura automática (A*)

O app calcula, no próprio navegador, a rota de **menor tempo de caminhada** entre as paradas, evitando qualquer célula do DEM acima do limite de inclinação escolhido (10–25°, padrão 15°). O custo considera a velocidade com traje (função de Tobler), a inclinação lateral e a proximidade do limite. Uma tabela compara a rota segura com a trilha do rover:

| Limite 15° | Trilha do rover | Rota segura A* |
|---|---|---|
| EVA-1: distância / inclinação máx. / trecho acima do limite | 905 m / 22° / 51 m | 573 m / 15° / 0 m |
| EVA-2: distância / inclinação máx. / trecho acima do limite | 1,14 km / 34° / 168 m | 912 m / 15° / 0 m |

O planejador e a medição percorrem exatamente as mesmas células do DEM (travessia de grade), e o A* não corta quinas de células íngremes. Por isso a rota segura nunca passa do limite fora da zona de ~8 m em volta das paradas. Quando não existe caminho abaixo do limite (por exemplo, a EVA-2 com 12°), o app avisa e mantém o trecho do rover.

**Validação do DEM:** nas 201 posições do Curiosity entre 2024 e 2025, a elevação do DEM difere da medida pelo rover em 0,30 m (mediana da diferença absoluta). A inclinação média do DEM nesses pontos (9,2°) é igual à inclinação média que o rover registrou (9,2°).

## Recursos de segurança

- **Rota colorida por inclinação**: verde (seguro), amarelo (atenção), vermelho (acima do limite). A inclinação é o máximo do DEM amostrado a cada 2 m ao longo do trecho, ignorando 12 m em volta das paradas.
- **Velocidade com traje** pela função de Tobler, com penalidade em terreno íngreme. Daí saem os horários de chegada e a duração.
- **Raio de abrigo**: distância que dá para percorrer a pé até o rover pressurizado em 15 min.
- **Alertas**: trecho íngreme à frente, reserva do PLSS, pôr do sol, evento solar com distância e tempo até o abrigo.
- **Consumíveis**: autonomia do PLSS de 8 h com reserva mínima de 1,5 h.
- **Dupla EV1/EV2** acompanhada por um rover pressurizado, que se reposiciona no ponto de recolhimento.

## Premissas (estimativas do projeto, não são dados medidos)

- Velocidade com traje de 2 km/h em terreno plano; PLSS de 8 h; blindagem do rover de 50%.
- O clima é um **modelo didático**: curvas diurnas dentro das faixas publicadas do REMS, não uma medição de um sol específico.
- As zonas científicas são aproximadas: envoltórias das posições do rover em cada fase da missão.
- A dose do evento SEP foi distribuída em 24 h só para fins de simulação.

## Estrutura

```
index.html          interface
css/style.css       layout tablet e HUD
js/app.js           mapa (OpenLayers), rota, linha do tempo, alertas, HUD
js/mission.js       EVAs, paradas, parâmetros de segurança, fontes
js/data-nasa.js     gerado a partir dos dados NASA (trajeto, paradas, fotos)
js/nav.js           busca, rotas A→B, passo a passo, Street View
js/data-dem.js      DEM HiRISE recortado (grade de 4 m) embutido
js/data-places.js   nomenclatura IAU de Marte (via Mars Trek)
data/               arquivos originais baixados (NASA e USGS)
tools/              scripts que baixam e geram os dados (fetch-dem.mjs precisa de `npm i geotiff`)
assets/photos/      fotos Navcam usadas nas paradas
vendor/             cópia local do OpenLayers 9.2.4
```

Créditos das imagens: NASA/JPL-Caltech, MSSS, University of Arizona, ASU, USGS, ESA/DLR/FU Berlin.
