import os
import sys

# Permite `import fornecedores_api` (e outros módulos de src/) sem precisar
# transformar src/ em um pacote instalável — mantém o projeto simples,
# conforme a regra "manter código simples" do CLAUDE.md.
SRC_DIR = os.path.join(os.path.dirname(__file__), "..", "src")
sys.path.insert(0, os.path.abspath(SRC_DIR))
