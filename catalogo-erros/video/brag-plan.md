# Brag Plan: JiraIA

## What is this app?
JiraIA é o processo agêntico que lê os logs de todos os sistemas do Instituto Tia Pretinha a cada 5 minutos, faz a triagem de cada erro com o Jev e decide sozinho o que é ruído, o que é problema conhecido e o que precisa de gente, sem nunca liberar o que envolve isolamento, dinheiro ou dado pessoal.

## The angle
O número real: 596 "casos de erro" no catálogo eram, na verdade, 25 problemas. O vídeo mostra o JiraIA transformando avalanche em lista curta, e a triagem acontecendo de verdade (perguntas tipadas com confiança), com as travas que nenhuma IA ultrapassa.

## Hook (0–3.7s)
Avalanche de linhas de log (sanitizadas) descendo rápido; o contador slam "596" com "casos de erro no catálogo." Reação: é muita coisa.

## Key moments
- "…eram 25 problemas." — os cartões colapsam; nasce o wordmark JiraIA.
- A triagem ao vivo: um erro real (`column r.deleted_at does not exist`) recebe 4 respostas do Jev, uma de cada vez, com barra de confiança: Ticket → PRB-0021 · Natureza → migration · Criticidade → ALTA · Ação → investigar.
- A trava: erro de `association_id` → cadeado vermelho `association-id` → "Nunca fecha. Nunca publica sozinho."
- O console real ITP_TEC ("Catálogo de Erros"): linhas entram com selos de criticidade e código PRB; a linha ALTA dispara "Alerta enviado · e-mail + Teams".

## Outro / punchline
"596 → 25." + JiraIA + "Captura. Triagem. Aprende."

## User flow worth showing
Log do container → triagem do Jev (respostas tipadas) → ticket no Catálogo de Erros + alerta imediato.

## Tone
- Preset: cinematic (contido)
- Creative direction: filme curto de produto de observabilidade — console sério, números reais, energia de trailer sem exagero.
- Interpretation: tipografia grande, poucas palavras por cena, cortes limpos nas batidas fortes, nenhuma alegação inventada.

## Format: landscape — 1920x1080 · 30fps
## Duration: ~24s

## Visual identity (from ITP_TEC, catalogo-erros-viewer/frontend/app/ui.tsx e Nav.tsx)
- Background console: #f4f5f7 · painel #ffffff · texto #1a1d21 · texto suave #5b6068
- Marca: roxo #4c1d95 (nav) / #5b21b6 (destaque) · amarelo #f2b705 (acento, borda da nav)
- Criticidade: baixa #dcefdc/#1e5c1e · media #fbead0/#8a5a00 · alta #fbdccb/#9a3b00 · critica #f6cdd0/#8f1620
- Display/body font: system-ui (o console usa Segoe UI/Tahoma/Arial; sem arquivo de fonte local) · mono: ui-monospace
- Strongest visual: barra roxa "ITP_TEC" com borda amarela + tabela densa com selos de criticidade.

## Share copy (draft)
596 "casos de erro" eram 25 problemas. O JiraIA lê os logs do Instituto a cada 5 minutos, faz a triagem com o Jev e só chama gente quando precisa — e nunca libera nada que envolva dinheiro, dado pessoal ou isolamento entre associações.

## Audio direction
- Role: cinematic support, contido
- Music: happy-beats-business-moves-vol-11-by-ende-dot-app.mp3 (114.84 BPM), entra forte, fade-out no logo final
- Music cue guidance: preset `cues/happy-beats-business-moves-vol-11...music-cues.md`. Strong cues: 1.60s (contador 596), 3.70s ("eram 25 problemas"), 5.80s (wordmark JiraIA), 12.65s (cadeado), 22.65s (logo final). Beat grid ~0.52s: respostas do Jev a cada 2 batidas (8.44, 9.50, 10.54, 11.60); linhas da tabela a cada 2 batidas (16.86, 17.91, 18.96).
- Audio-reactive: indisponível (sem numpy/extrator nesta máquina) — documentado, não bloqueia.
- SFX posture: sparse, motion-matched — impacto suave no 596 e no cadeado, click leve por resposta do Jev, card-slide nas linhas, sino no logo final.
- Restraint rule: nada de SFX em cada linha de log da avalanche; nada estridente repetido.

## Privacy
Linhas de log são reescritas/sanitizadas: sem IPs, hosts internos, chaves, e-mails ou nomes de moradores. Códigos PRB e mensagens de erro técnicas são reais e não contêm dado pessoal.

## Storyboard
### Scene 1 — Avalanche — 0.00–3.70s (3.7s)
Fundo roxo profundo; colunas de linhas de log em mono descendo. Em 1.60s (beat-locked) slam do número "596" gigante em amarelo + "casos de erro no catálogo." (hold ≥1.5s).
Sequential: linhas de log (textura, não precisam ser lidas).
Audio: música entra; impacto suave em 1.60. Transition: hard cut → S2.
### Scene 2 — Reveal — 3.70–7.38s (3.68s)
Em 3.70 (beat-locked) "…eram 25 problemas." (hold ~1.4s); cartões colapsam; em 5.80 (beat-locked) wordmark "Jira" + "IA" em amarelo, tagline "Triagem autônoma de erros · ITP".
Audio: whoosh/impacto suave; sino leve no wordmark. Transition: clean wipe → S3.
### Scene 3 — A triagem — 7.38–12.12s (4.74s)
Card de erro (mono) `ERROR: column r.deleted_at does not exist` com label "erro novo · itp_postgres". Painel "Jev" à direita: 4 perguntas; respostas entram a cada 2 batidas (8.44, 9.50, 10.54, 11.60) com barra de confiança: Ticket PRB-0021 · Natureza migration · Criticidade ALTA (selo alta) · Ação investigar. Hold do conjunto até o fim.
Audio: click suave por resposta. Transition: hard cut → S4.
### Scene 4 — A trava — 12.12–16.34s (4.22s)
Card `RAISE EXCEPTION 'packages.association_id nao bate com residents.association_id'`; em 12.65 (beat-locked) cadeado vermelho "🔒 association-id" slam; linha "Nunca fecha. Nunca publica sozinho." (hold ≥2s).
Audio: impacto pesado suave no cadeado. Transition: clean → S5.
### Scene 5 — No catálogo — 16.34–20.54s (4.2s)
Console ITP_TEC (barra roxa com borda amarela, "Catálogo de Erros"): tabela; 3 linhas entram (16.86, 17.91, 18.96): PRB-0013 baixa "Robôs de varredura" · PRB-0019 baixa "Server Action após deploy" · PRB-0021 ALTA "Coluna ausente no schema". Em 19.49 toast "Alerta enviado · e-mail + Teams".
Audio: card-slide por linha; click no toast. Transition: dip → S6.
### Scene 6 — Punchline — 20.54–24.23s (3.69s)
"596 → 25" grande; wordmark JiraIA; "Captura. Triagem. Aprende." Logo final em 22.65 (beat-locked). Fade de música até 24.2.
Audio: sino no logo; música faz fade.
**Music mood:** confiante, produto. **Audio summary:** entra forte no 596, pulsa na triagem, fecha com sino no logo.
