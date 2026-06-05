// Adaptador MongoDB em memória — mesma interface do driver oficial 'mongodb'.
// Para usar MongoDB real, substitua este arquivo por:
//
//   const { MongoClient } = require('mongodb');
//   const client = new MongoClient(process.env.MONGO_URI || 'mongodb://localhost:27017');
//   let _db;
//   async function conectar() {
//     await client.connect();
//     _db = client.db('laboratorio');
//     console.log('[MongoDB] Conectado em', process.env.MONGO_URI);
//   }
//   function getDb() { return _db; }
//   module.exports = { conectar, getDb, ObjectId };

// ── ObjectId — identificador único similar ao MongoDB ────────────────────────

class ObjectId {
  constructor(id = null) {
    this._id = id || (
      Math.floor(Date.now() / 1000).toString(16).padStart(8, '0') +
      Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('')
    );
  }
  toString()      { return this._id; }
  toHexString()   { return this._id; }
  equals(other)   { return this._id === (other?._id ?? other?.toString() ?? other); }
  toJSON()        { return this._id; }
}

// ── Cursor — resultado lazy de find() ────────────────────────────────────────

class Cursor {
  constructor(docs) { this._docs = [...docs]; }

  sort(spec) {
    const [[field, dir]] = Object.entries(spec);
    this._docs.sort((a, b) => {
      const va = resolveField(a, field);
      const vb = resolveField(b, field);
      if (va instanceof Date && vb instanceof Date) return dir === -1 ? vb - va : va - vb;
      return dir === -1 ? (vb > va ? 1 : -1) : (va > vb ? 1 : -1);
    });
    return this;
  }

  limit(n) { this._docs = this._docs.slice(0, n); return this; }
  skip(n)  { this._docs = this._docs.slice(n);    return this; }
  async toArray()   { return [...this._docs]; }
  async forEach(fn) { this._docs.forEach(fn); return this; }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveField(doc, path) {
  return path.split('.').reduce((o, k) => o?.[k], doc);
}

function resolveExpr(doc, expr) {
  if (typeof expr !== 'string')   return expr;
  if (!expr.startsWith('$'))      return expr;
  return resolveField(doc, expr.slice(1));
}

function matchDoc(doc, query) {
  if (!query || Object.keys(query).length === 0) return true;
  return Object.entries(query).every(([key, val]) => {
    if (key === '$or')  return val.some(q => matchDoc(doc, q));
    if (key === '$and') return val.every(q => matchDoc(doc, q));
    const docVal = resolveField(doc, key);
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      return Object.entries(val).every(([op, opVal]) => {
        if (op === '$gte') return docVal >= opVal;
        if (op === '$lte') return docVal <= opVal;
        if (op === '$gt')  return docVal >  opVal;
        if (op === '$lt')  return docVal <  opVal;
        if (op === '$in')  return Array.isArray(opVal) && opVal.includes(docVal);
        if (op === '$nin') return Array.isArray(opVal) && !opVal.includes(docVal);
        if (op === '$ne')  return docVal !== opVal;
        return false;
      });
    }
    // Comparação direta (incluindo Date e ObjectId)
    return String(docVal) === String(val) || docVal === val;
  });
}

// ── Collection ────────────────────────────────────────────────────────────────

class Collection {
  constructor(name) {
    this._name = name;
    this._docs = [];
  }

  async insertOne(doc) {
    const _id = doc._id || new ObjectId();
    const stored = { _id, ...doc };
    this._docs.push(stored);
    return { acknowledged: true, insertedId: _id };
  }

  async insertMany(docs) {
    const ids = [];
    for (const d of docs) {
      const r = await this.insertOne(d);
      ids.push(r.insertedId);
    }
    return { acknowledged: true, insertedIds: ids };
  }

  async findOne(query = {}) {
    return this._docs.find(d => matchDoc(d, query)) ?? null;
  }

  // Retorna Cursor (síncrono) — .toArray() é async
  find(query = {}) {
    const matched = this._docs.filter(d => matchDoc(d, query));
    return new Cursor(matched);
  }

  async countDocuments(query = {}) {
    return this._docs.filter(d => matchDoc(d, query)).length;
  }

  async deleteMany(query = {}) {
    const antes = this._docs.length;
    this._docs = this._docs.filter(d => !matchDoc(d, query));
    return { acknowledged: true, deletedCount: antes - this._docs.length };
  }

  // Atualiza o primeiro documento que casa com a query
  async updateOne(query, update) {
    const idx = this._docs.findIndex(d => matchDoc(d, query));
    if (idx === -1) return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
    if (update.$set)  Object.assign(this._docs[idx], update.$set);
    if (update.$push) {
      for (const [field, val] of Object.entries(update.$push)) {
        if (!Array.isArray(this._docs[idx][field])) this._docs[idx][field] = [];
        this._docs[idx][field].push(val);
      }
    }
    return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
  }

  async deleteOne(query = {}) {
    const idx = this._docs.findIndex(d => matchDoc(d, query));
    if (idx === -1) return { acknowledged: true, deletedCount: 0 };
    this._docs.splice(idx, 1);
    return { acknowledged: true, deletedCount: 1 };
  }

  // Aggregation pipeline simplificado
  aggregate(pipeline) {
    let docs = [...this._docs];

    for (const stage of pipeline) {
      const [op] = Object.keys(stage);

      if (op === '$match') {
        docs = docs.filter(d => matchDoc(d, stage.$match));

      } else if (op === '$group') {
        docs = this._execGroup(docs, stage.$group);

      } else if (op === '$sort') {
        const cursor = new Cursor(docs);
        cursor.sort(stage.$sort);
        docs = cursor._docs;

      } else if (op === '$limit') {
        docs = docs.slice(0, stage.$limit);

      } else if (op === '$skip') {
        docs = docs.slice(stage.$skip);

      } else if (op === '$project') {
        docs = docs.map(d => this._execProject(d, stage.$project));

      } else if (op === '$count') {
        docs = [{ [stage.$count]: docs.length }];

      } else if (op === '$unwind') {
        const field = stage.$unwind.replace('$', '');
        const unwound = [];
        docs.forEach(d => {
          const arr = resolveField(d, field);
          if (Array.isArray(arr)) {
            arr.forEach(item => unwound.push({ ...d, [field]: item }));
          } else {
            unwound.push(d);
          }
        });
        docs = unwound;
      }
    }

    // Retorna objeto com .toArray() igual ao driver real
    return { toArray: async () => docs };
  }

  _execGroup(docs, spec) {
    const { _id: idExpr, ...accumulators } = spec;
    const groups = new Map();

    for (const doc of docs) {
      const rawKey = typeof idExpr === 'string'
        ? (idExpr === null ? null : resolveExpr(doc, idExpr))
        : (idExpr === null ? null : JSON.stringify(
            Object.fromEntries(Object.entries(idExpr).map(([k, v]) => [k, resolveExpr(doc, v)]))
          ));
      const keyStr = JSON.stringify(rawKey ?? null);

      if (!groups.has(keyStr)) {
        groups.set(keyStr, { _id: rawKey ?? null });
      }
      const grp = groups.get(keyStr);

      for (const [field, expr] of Object.entries(accumulators)) {
        if (expr.$sum !== undefined) {
          const v = typeof expr.$sum === 'number' ? expr.$sum : parseFloat(resolveExpr(doc, expr.$sum)) || 0;
          grp[field] = (grp[field] ?? 0) + v;
        } else if (expr.$count !== undefined) {
          grp[field] = (grp[field] ?? 0) + 1;
        } else if (expr.$push !== undefined) {
          if (!grp[field]) grp[field] = [];
          grp[field].push(resolveExpr(doc, expr.$push));
        } else if (expr.$addToSet !== undefined) {
          if (!grp[field]) grp[field] = [];
          const v = resolveExpr(doc, expr.$addToSet);
          if (!grp[field].includes(v)) grp[field].push(v);
        } else if (expr.$first !== undefined) {
          if (grp[field] === undefined) grp[field] = resolveExpr(doc, expr.$first);
        } else if (expr.$last !== undefined) {
          grp[field] = resolveExpr(doc, expr.$last);
        } else if (expr.$max !== undefined) {
          const v = resolveExpr(doc, expr.$max);
          grp[field] = grp[field] === undefined || v > grp[field] ? v : grp[field];
        } else if (expr.$min !== undefined) {
          const v = resolveExpr(doc, expr.$min);
          grp[field] = grp[field] === undefined || v < grp[field] ? v : grp[field];
        }
      }
    }
    return Array.from(groups.values());
  }

  _execProject(doc, spec) {
    const out = {};
    for (const [k, v] of Object.entries(spec)) {
      if (v === 1 || v === true) out[k] = resolveField(doc, k);
      else if (typeof v === 'string' && v.startsWith('$')) out[k] = resolveExpr(doc, v);
    }
    // Always include _id unless explicitly excluded
    if (spec._id !== 0 && spec._id !== false && !('_id' in out)) out._id = doc._id;
    return out;
  }
}

// ── Db ────────────────────────────────────────────────────────────────────────

class Db {
  constructor() { this._cols = new Map(); }
  collection(name) {
    if (!this._cols.has(name)) this._cols.set(name, new Collection(name));
    return this._cols.get(name);
  }
}

// ── Conexão ───────────────────────────────────────────────────────────────────

let _db = null;

async function conectar() {
  _db = new Db();
  console.log('[MongoDB] Adaptador em memória ativo (sem servidor externo)');
}

function getDb() {
  if (!_db) throw new Error('[MongoDB] Não inicializado — chame conectar() na inicialização do servidor');
  return _db;
}

module.exports = { conectar, getDb, ObjectId };
