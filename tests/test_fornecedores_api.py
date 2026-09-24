"""
Testes unitários para funções puras de src/fornecedores_api.py.

Não requerem PostgreSQL nem o Flask rodando — validam apenas a lógica de
`validar_cnpj`, que é a parte mais fácil de quebrar silenciosamente.
Servem de exemplo mínimo de teste unitário Python para a esteira de CI
(job `test-python-unit` em .github/workflows/ci.yml).

Rodar com: pytest tests/ -v
"""
from fornecedores_api import validar_cnpj


def test_cnpj_valido_conhecido():
    # CNPJ válido de exemplo (dígitos verificadores corretos).
    assert validar_cnpj("11.222.333/0001-81") is True


def test_cnpj_valido_sem_formatacao():
    assert validar_cnpj("11222333000181") is True


def test_cnpj_invalido_digito_verificador_errado():
    assert validar_cnpj("11222333000180") is False


def test_cnpj_invalido_tamanho_errado():
    assert validar_cnpj("123") is False


def test_cnpj_invalido_todos_digitos_iguais():
    # 14 dígitos iguais passam no tamanho, mas devem ser rejeitados.
    assert validar_cnpj("11111111111111") is False


def test_cnpj_invalido_vazio():
    assert validar_cnpj("") is False
