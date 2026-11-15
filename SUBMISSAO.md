# Submissão · NASA Space Apps 2026

## Nome do projeto
ARES · GALE: mapa de EVA para o Monte Sharp

## Resumo de alto nível
ARES · GALE é um aplicativo de tablet, com um modo HUD para o visor do capacete, que ajuda os primeiros astronautas em Marte a planejar e executar caminhadas (EVAs) com segurança. Ele funde dados de várias missões da NASA (HiRISE, CTX, THEMIS, MOLA, Curiosity RAD, REMS e Navcam) num mapa hiperlocal, na escala de metros, das encostas do Monte Sharp, na cratera Gale. Ali o Curiosity encontrou enxofre elementar (2024) e formações de boxwork (2025).

Ferramentas como o Mars Trek mostram Marte em escala global e regional. O astronauta precisa saber onde pisar nos próximos 100 metros. Por isso o app calcula, a partir do DEM HiRISE de 1 m, uma rota segura que evita encostas acima do limite escolhido. Ele também mostra horários com a velocidade de caminhada com traje, dose de radiação, autonomia do traje, raio de abrigo até o rover pressurizado e alertas de evento solar. Cada parada tem as fotos reais que o Curiosity tirou naquele ponto. O app oferece busca de lugares, rotas A→B, navegação passo a passo e um "Street View" marciano com os 1.389 pontos do trajeto do rover.

O resultado leva a segurança da tripulação, prioridade nº 1 da NASA, para dentro do mapa que o astronauta usa em campo.

## Link para a demonstração
https://d3vrya.github.io/Hackathon/slides/ (7 slides; PDF: https://d3vrya.github.io/Hackathon/slides/ARES-GALE-demo.pdf)

## Link para o projeto final
https://d3vrya.github.io/Hackathon/ (código-fonte: https://github.com/d3vrya/Hackathon)

## Descrição detalhada

### O que ele faz
- **Duas EVAs planejadas sobre o trajeto real do Curiosity.** A EVA-1 vai ao canal Gediz Vallis e ao campo de enxofre elementar. A EVA-2 vai à rede de boxwork. Cada parada tem objetivo científico, tarefas, perigos e as fotos Navcam tiradas exatamente ali.
- **Rota segura automática (A\*).** Calcula o caminho de menor tempo de caminhada com traje, evitando células do DEM acima do limite de inclinação (10–25°). Com limite de 15°, nas duas EVAs, o trecho acima do limite cai de 218 m (trilha do rover) para 0 m (rota segura).
- **Camadas de dados com controle de opacidade:**
  - Óptico: HiRISE de ~25 cm, CTX e Viking.
  - Topográfico: DEM HiRISE de 1 m, mapa de inclinação real e MOLA/HRSC.
  - Térmico: THEMIS IR noturno, que separa rocha de areia e poeira.
  - Trajeto do Curiosity e zonas científicas.
- **Painéis de segurança ligados à linha do tempo:**
  - Radiação: taxa GCR medida pelo RAD e simulação do evento solar de 20/mai/2024 (8,1 mGy medidos em Gale).
  - Ambiente: modelo diurno calibrado por faixas do REMS.
  - Autonomia do traje (PLSS).
  - Raio de abrigo de 15 min até o rover.
  - Alertas de trecho íngreme e de pôr do sol.
- **Navegação estilo Google Maps:**
  - Busca: paradas, 1.783 nomes oficiais da IAU, qualquer sol do Curiosity e coordenadas.
  - Rotas A→B com 3 alternativas: mais segura, recomendada e mais rápida.
  - Instruções passo a passo.
  - "Street View" com as fotos brutas do Curiosity em qualquer ponto do trajeto.
- **Modo HUD do capacete:** bússola, seta de rumo, próxima manobra, distância, dose, temperatura, autonomia, minimapa e alertas sobre a foto real do destino.

### Como funciona
- O app roda inteiro no navegador, com HTML/JavaScript e OpenLayers, sem servidor.
- Os mapas de fundo vêm do serviço WMTS do NASA Mars Trek, numa projeção geográfica de Marte (raio de 3.389,5 km).
- Um recorte de 3 × 4 km do mosaico DEM HiRISE de 1 m de Gale foi lido por leitura parcial (HTTP Range) do arquivo do USGS e embutido no app numa grade de 4 m. O app calcula a inclinação de cada célula e roda o A* sobre ela.
- O custo de cada passo é o tempo de caminhada (função de Tobler), com penalidade para inclinação lateral e para proximidade do limite. Não são permitidos cortes de quina.
- **Validação:** nas 201 posições do Curiosity entre 2024 e 2025, a elevação do DEM difere da medida pelo rover em 0,30 m (mediana da diferença absoluta). A inclinação média do DEM nesses pontos (9,2°) é igual à inclinação que o próprio rover registrou (9,2°).

### Benefícios
- Um mapa na escala da caminhada, e não na escala regional.
- Segurança calculada, em vez de estimada a olho: encostas, abrigo, radiação, autonomia e luz.
- Contexto científico e visual de cada parada antes de chegar, com as fotos reais do local.
- Funciona em tablet, celular e HUD, sem instalação.

### O que esperamos alcançar
Mostrar que os dados que a NASA já tem permitem planejar hoje caminhadas humanas seguras e cientificamente ricas em Marte. Mostrar também que a mesma abordagem (DEM de alta resolução, rota A* com limites de traje, dados de radiação e imagens de superfície) se aplica a qualquer local candidato com DEM HiRISE, incluindo as Zonas de Exploração para missões humanas.

### Ferramentas
- HTML5, CSS, JavaScript e OpenLayers 9.2.4.
- Node.js, com a biblioteca geotiff.js, para o pré-processamento dos dados.
- Microsoft Edge e Puppeteer para os testes automatizados da interface.

### Limitações conhecidas
- A grade de 4 m não enxerga blocos isolados menores que ~4 m.
- O clima é um modelo didático calibrado por faixas do REMS, não uma medição de um sol específico.
- Velocidade de caminhada com traje, autonomia do PLSS e blindagem do rover são premissas do projeto.

## Uso de Superinteligência (SI)
<!-- REVISAR com a equipe antes de enviar: descreva com precisão o que foi feito por vocês e o que foi feito com IA. -->
Sim. Usamos o assistente de IA Claude (Anthropic), pelo Claude Code, como ferramenta de desenvolvimento:
- Escrita do código do aplicativo (JavaScript/HTML/CSS) e dos scripts de pré-processamento de dados (pasta `tools/`).
- Busca e teste de serviços de dados da NASA e do USGS.
- Implementação do planejador de rotas A\* e da validação do DEM.
- Redação de textos da interface, do README e deste formulário.

Todos os dados científicos vêm de fontes da NASA, USGS e ESA listadas abaixo. Nenhuma imagem do projeto foi gerada por IA: todas as fotos e mapas são dados de missões reais. O projeto não usa logotipos nem elementos de marca da NASA.

## Dados da NASA
- **Mars Trek (NASA/JPL):** tiles WMTS do mosaico HiRISE do local do Curiosity, mosaico CTX de Gale, DEM HiRISE de Gale (visualização), MGS MOLA, Viking MDIM 2.1 e Mars Odyssey THEMIS IR noturno (100 m). Também o catálogo de camadas e a nomenclatura planetária IAU.
- **NASA/JPL MMGIS (MSL):** trajeto e posições do Curiosity (`MSL_traverse.json` e `MSL_waypoints.json`), com sol, elevação e inclinação do rover até o sol 5073.
- **API de imagens brutas da NASA (mars.nasa.gov):** fotos Navcam do Curiosity em cada parada e no "Street View".
- **Curiosity RAD:** dose na superfície de 0,64 mSv/sol e 0,21 mGy/sol (Hassler et al., *Science*, 2014) e evento de partículas solares de 20/mai/2024 (8,1 mGy, NASA/JPL, 2024).
- **Curiosity REMS:** faixas de temperatura do ar e do solo, pressão e UV em Gale, usadas para calibrar o modelo diurno.
- **NASA-STD-3001:** limite de dose de carreira de 600 mSv.

## Dados de parceiros e outras referências
- **ESA:** Mars Express HRSC, no mosaico combinado MOLA + HRSC de relevo sombreado (ESA/DLR/FU Berlin, via Mars Trek).
- **USGS Astrogeology Science Center:** mosaico DEM HiRISE de 1 m de Gale da equipe MSL (`MSL_Gale_DEM_Mosaic_1m_v3`, Calef & Parker), lido do bucket público do USGS.
- **University of Arizona (HiRISE), MSSS (CTX/Mastcam), ASU (THEMIS):** produtoras das imagens orbitais.
- **Software de código aberto:** OpenLayers 9.2.4 (BSD-2), geotiff.js (MIT) e Puppeteer (Apache-2.0).
- **Método:** função de caminhada de Tobler (1993), para a velocidade em função da inclinação, e algoritmo A\* (Hart, Nilsson e Raphael, 1968).
