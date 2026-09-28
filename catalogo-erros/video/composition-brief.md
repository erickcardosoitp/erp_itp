# Hyperframes Composition Brief: JiraIA

## Objective
Vídeo curto (~24.3s) de lançamento interno do JiraIA, o processo agêntico de captura e triagem de erros do ITP.

## Output
- Composition: `composition/` · Render: `brag.mp4` · landscape 1920x1080 · 30fps · 24.3s

## Source Material
- Projeto: erp_itp/catalogo-erros (coletor.py, jev_client.py, base_conhecimento.py) e catalogo-erros-viewer/frontend (ui.tsx, Nav.tsx, erros/page.tsx)
- Claim mais forte: "596 casos de erro eram 25 problemas."
- UI real recriada: barra ITP_TEC (roxo #4c1d95 + borda #f2b705) e tabela "Catálogo de Erros" com selos de criticidade.
- Copy verbatim: "596" · "casos de erro no catálogo." · "…eram 25 problemas." · "JiraIA" · "Nunca fecha. Nunca publica sozinho." · "Alerta enviado · e-mail + Teams" · "Captura. Triagem. Aprende."
- Dados reais: triagem do erro `column r.deleted_at does not exist` → PRB-0021 · migration · ALTA · alto risco. Trava association_id 9/9 barrados no teste. 9 containers monitorados. Sem valores de confiança inventados.

## Creative Direction
- Tone: cinematic contido — filme curto de produto de observabilidade. Cortes nas batidas fortes, tipografia grande, poucas palavras.
- Hook: avalanche de logs + slam "596". Outro: "596 → 25" + JiraIA.
- Avoid: linguagem SaaS genérica, filler abstrato, IPs/hosts/segredos/nomes de pessoas.

## Visual Identity
- Escuro de abertura/fecho: #1a0b33 com glow radial #4c1d95; claro do console: #f4f5f7, painel #fff, texto #1a1d21, suave #5b6068, borda forte #8a8f98.
- Acento #f2b705; destaque #5b21b6; selos: baixa #dcefdc/#1e5c1e · alta #fbdccb/#9a3b00 · crítica/trava #8f1620.
- Fontes: system-ui (sem arquivo local; o console usa Segoe UI) · ui-monospace.

## Storyboard
Ver brag-plan.md (6 cenas). Ajuste: S5 16.34–21.07 (toast precisa de leitura), S6 21.07–24.30.

## Audio
- Música: assets/music/happy-beats-business-moves-vol-11-by-ende-dot-app.mp3, fade-in 0.3s, fade-out 23.3→24.3.
- Beat-locked: 1.60 (596), 3.70 (frase), 5.80 (wordmark), 12.65 (cadeado), 22.65 (logo). Beat-grid: respostas do Jev 7.91/8.96/10.01/11.06; linhas da tabela 16.86/17.91/18.96; toast 19.49.
- SFX (Kenney CC0, baixo risco HF): impactSoft_medium_001, impactSoft_heavy_003, impactBell_heavy_000, click_003, drop_002, card-slide-1.
- Audio-reactive: não aplicado — extrator exige numpy, indisponível nesta máquina.
