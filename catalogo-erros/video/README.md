# Vídeo de apresentação do JiraIA

Primeiro rascunho (24,3 s, 1920×1080), gerado em 2026-09-28 com a skill `/brag` ([latent-spaces/brag](https://github.com/latent-spaces/brag), MIT) sobre o [Hyperframes](https://hyperframes.heygen.com/).

| Arquivo | O que é |
|---|---|
| `brag-plan.md` | Ângulo, gancho, storyboard e direção de áudio |
| `composition-brief.md` | Brief entregue ao Hyperframes |
| `index.html` | Composição Hyperframes (GSAP) |

## Renderizar

Os áudios não são versionados: a trilha (`happy-beats-business-moves-vol-11`, ende.app) tem licença a confirmar antes de redistribuir, e os efeitos são Kenney (CC0). Para renderizar, copie-os da skill instalada:

```bash
mkdir -p assets/music assets/sfx/{impact,interface,casino,ui}
B=~/.claude/skills/brag/assets
cp $B/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3 assets/music/
cp $B/sfx/impact/{impactSoft_medium_001,impactSoft_heavy_003,impactBell_heavy_000}.ogg assets/sfx/impact/
cp $B/sfx/interface/drop_002.ogg assets/sfx/interface/
cp $B/sfx/casino/card-slide-1.ogg assets/sfx/casino/
cp $B/sfx/ui/click2.ogg assets/sfx/ui/
npx hyperframes check && npx hyperframes render --output brag.mp4
```

Requer FFmpeg/FFprobe no `PATH` e Chrome.

## Dados

Todos os números e textos são reais (596 → 25 tickets, triagem do PRB-0021, trava 9/9, 9 containers). Linhas de log sanitizadas: sem IPs, hosts, segredos ou nomes de pessoas.
