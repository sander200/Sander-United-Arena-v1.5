# Sander United Arena — v1.5

Versão HTML5/Canvas para GitHub Pages.

## Visão de jogo
- Mapa completo no minimapa fixo na parte superior esquerda.
- Sander e Némesis marcados em tempo real.
- Retângulo do minimapa indica a região atualmente enquadrada pela câmera.
- Canvas principal mostra apenas a região ao redor de Sander.
- Câmera acompanha Sander suavemente e respeita os limites do mapa.
- Caminhos são transitáveis; áreas verdes/arbustos/árvores e limites são bloqueados pela máscara de navegação.
- Némesis usa a mesma regra de navegação, coleta energia e persegue Sander.
- Em celular, o jogo foi otimizado para orientação horizontal e controles touch.

## Controles
- Setas: movimentação.
- Z: ataque básico.
- X: ataque especial.
- C: teletransporte, recarga de 30 segundos.

## Estrutura
`index.html`, `game.js`, `styles.css` e `assets/`.

Não depende de backend e é compatível com GitHub Pages.
