<!--
Preencha antes de pedir revisão. Um PR bem descrito reduz o tempo de
revisão e evita aprovações "no escuro" — ver docs/COLABORACAO_EQUIPE.md,
seção 3.4.
-->

## O que este PR faz

<!-- Descreva em 1-3 frases. -->

## Issue relacionada

Resolve #<!-- número da issue do backlog -->

## Como testar

<!-- Comandos exatos que o revisor deve rodar. Ex.: -->
- [ ] `npm run lint`
- [ ] `npm run test:unit`
- [ ] `npm run test:integration` (requer PostgreSQL ativo)
- [ ] Testado manualmente em: <!-- URL/página -->

## Este PR afeta segurança ou dados sensíveis?

- [ ] Sim — descreva o que mudou e por que é seguro:
- [ ] Não

## Checklist antes de pedir revisão

- [ ] Fiz `git rebase origin/main` (ou `pull`) recentemente — branch está atualizada
- [ ] `npm run lint` e `flake8` passam localmente
- [ ] Testes relevantes passam localmente
- [ ] Nenhum segredo/credencial real foi commitado
- [ ] Atualizei a documentação relevante, se aplicável (`CLAUDE.md`, `docs/`)
