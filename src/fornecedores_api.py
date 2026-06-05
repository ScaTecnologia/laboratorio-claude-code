from flask import Flask, request, jsonify
import psycopg2
import psycopg2.extras

app = Flask(__name__)

DB = {
    'host':     'localhost',
    'port':     5151,
    'database': 'laboratorio',
    'user':     'postgres',
    'password': '5151',
}

CAMPOS = ['nomefantasia', 'nomeempresa', 'endereco', 'bairro', 'cidade', 'estado', 'email', 'telefone', 'cnpj']


def get_conn():
    return psycopg2.connect(**DB)


def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS fornecedores (
                    id           SERIAL PRIMARY KEY,
                    nomefantasia TEXT,
                    nomeempresa  TEXT NOT NULL,
                    endereco     TEXT,
                    bairro       TEXT,
                    cidade       TEXT,
                    estado       TEXT,
                    email        TEXT,
                    telefone     TEXT,
                    cnpj         TEXT
                )
            """)
        conn.commit()
    print('Tabela fornecedores verificada/criada.')


@app.route('/fornecedores', methods=['GET'])
def listar():
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT * FROM fornecedores ORDER BY id')
            return jsonify([dict(r) for r in cur.fetchall()])


@app.route('/fornecedores/<int:fid>', methods=['GET'])
def buscar(fid):
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute('SELECT * FROM fornecedores WHERE id = %s', (fid,))
            row = cur.fetchone()
    if not row:
        return jsonify({'erro': 'Fornecedor não encontrado'}), 404
    return jsonify(dict(row))


@app.route('/fornecedores', methods=['POST'])
def criar():
    data = request.get_json() or {}
    if not data.get('nomeempresa'):
        return jsonify({'erro': 'Nome da empresa é obrigatório'}), 400
    valores = [data.get(c) for c in CAMPOS]
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            placeholders = ','.join(['%s'] * len(CAMPOS))
            cur.execute(
                f"INSERT INTO fornecedores ({','.join(CAMPOS)}) VALUES ({placeholders}) RETURNING *",
                valores,
            )
            row = cur.fetchone()
        conn.commit()
    return jsonify(dict(row)), 201


@app.route('/fornecedores/<int:fid>', methods=['PUT'])
def atualizar(fid):
    data = request.get_json() or {}
    sets, valores = [], []
    for campo in CAMPOS:
        if campo in data:
            sets.append(f'{campo} = %s')
            valores.append(data[campo])
    if not sets:
        return buscar(fid)
    valores.append(fid)
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(
                f"UPDATE fornecedores SET {', '.join(sets)} WHERE id = %s RETURNING *",
                valores,
            )
            row = cur.fetchone()
        conn.commit()
    if not row:
        return jsonify({'erro': 'Fornecedor não encontrado'}), 404
    return jsonify(dict(row))


@app.route('/fornecedores/<int:fid>', methods=['DELETE'])
def deletar(fid):
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute('DELETE FROM fornecedores WHERE id = %s', (fid,))
            deleted = cur.rowcount
        conn.commit()
    if not deleted:
        return jsonify({'erro': 'Fornecedor não encontrado'}), 404
    return jsonify({'mensagem': 'Fornecedor removido'})


if __name__ == '__main__':
    init_db()
    print('API de Fornecedores rodando em http://localhost:3001')
    app.run(port=3001, debug=False)
