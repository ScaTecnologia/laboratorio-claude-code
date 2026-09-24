#!/bin/sh
# ============================================================================
# atualizar_docx.sh — regenera os .docx do laboratório a partir dos .md.
# ----------------------------------------------------------------------------
# Os .md são a fonte da verdade; os .docx são só uma versão para leitura/
# impressão. Usa a imagem Docker oficial do pandoc (nada a instalar).
#   sh docs/atualizar_docx.sh
# ============================================================================
set -e
cd "$(dirname "$0")"
for doc in BACKLOG_KANBAN COLABORACAO_EQUIPE DEVOPS_GUIA EXERCICIO_MULTIPLOS_DEVS \
           ROTEIRO_CICD_CLAUDE_CODE SETUP_NOVA_MAQUINA SIMULANDO_2_DEVS STATUS_LABORATORIO; do
  docker run --rm -u "$(id -u):$(id -g)" -v "$PWD":/data pandoc/core:3.11 \
    "$doc.md" -f gfm -o "$doc.docx"
  echo "ok  docs/$doc.docx"
done
