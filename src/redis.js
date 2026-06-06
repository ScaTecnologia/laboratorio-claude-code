// Adaptador Redis em memória — mesmo comportamento do Redis real, sem instalação.
// Usa um Map JavaScript com controle de TTL via timestamps.
// Para produção com Redis real: npm install ioredis e troque este arquivo por:
//   const Redis = require('ioredis');
//   module.exports = new Redis({ host: 'localhost', port: 6379 });

class RedisMock {
  constructor() {
    // _store: Map<key, { value, expiresAt: timestamp|null }>
    this._store    = new Map();
    this._handlers = {};
    // Simula evento "connect" após inicialização
    setImmediate(() => this._emit('connect'));
  }

  // ── Interface de eventos (compatível com ioredis) ─────────────────────────
  on(event, cb) {
    if (!this._handlers[event]) this._handlers[event] = [];
    this._handlers[event].push(cb);
    return this;
  }
  _emit(event, arg) {
    (this._handlers[event] || []).forEach(cb => cb(arg));
  }

  // ── TTL helpers ──────────────────────────────────────────────────────────
  _vivo(entry) {
    return entry && (!entry.expiresAt || Date.now() < entry.expiresAt);
  }
  _ler(key) {
    const e = this._store.get(key);
    if (!this._vivo(e)) { this._store.delete(key); return null; }
    return e;
  }

  // ── Comandos básicos ──────────────────────────────────────────────────────
  async ping()               { return 'PONG'; }
  async disconnect()         {}

  async get(key) {
    const e = this._ler(key);
    return e ? e.value : null;
  }

  async set(key, value) {
    this._store.set(key, { value: String(value), expiresAt: null });
    return 'OK';
  }

  // SET com EXpire — armazena e define quando expira
  async setex(key, ttlSec, value) {
    this._store.set(key, { value: String(value), expiresAt: Date.now() + ttlSec * 1000 });
    return 'OK';
  }

  async expire(key, ttlSec) {
    const e = this._ler(key);
    if (!e) return 0;
    e.expiresAt = Date.now() + ttlSec * 1000;
    return 1;
  }

  // Retorna segundos restantes (-2 = não existe, -1 = sem TTL)
  async ttl(key) {
    const e = this._ler(key);
    if (!e) return -2;
    if (!e.expiresAt) return -1;
    return Math.max(0, Math.ceil((e.expiresAt - Date.now()) / 1000));
  }

  async del(...keys) {
    let n = 0;
    for (const k of keys.flat()) if (this._store.delete(k)) n++;
    return n;
  }

  async incrby(key, amount) {
    const e     = this._ler(key);
    const atual = e ? parseInt(e.value, 10) : 0;
    const novo  = atual + parseInt(amount, 10);
    if (e) {
      e.value = String(novo);
    } else {
      this._store.set(key, { value: String(novo), expiresAt: null });
    }
    return novo;
  }

  // ── Comandos Hash (para o carrinho) ───────────────────────────────────────
  async hset(key, field, value) {
    let e = this._ler(key);
    if (!e) {
      e = { value: {}, expiresAt: null };
      this._store.set(key, e);
    }
    e.value[String(field)] = String(value);
    return 1;
  }

  async hgetall(key) {
    const e = this._ler(key);
    if (!e || typeof e.value !== 'object') return null;
    return { ...e.value };
  }

  async hdel(key, field) {
    const e = this._ler(key);
    if (!e || typeof e.value !== 'object') return 0;
    if (String(field) in e.value) { delete e.value[String(field)]; return 1; }
    return 0;
  }

  // Conta chaves vivas
  async dbsize() {
    let n = 0;
    for (const [k] of this._store) if (this._ler(k)) n++;
    return n;
  }

  // Retorna chaves que casam com o padrão (suporta * como wildcard)
  async keys(pattern) {
    const regex = new RegExp('^' + pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    const result = [];
    for (const [k] of this._store) {
      if (regex.test(k) && this._ler(k)) result.push(k);
    }
    return result;
  }

  // ── Eval (Lua simulado) — usado para reserva atômica de estoque ───────────
  // Node.js é single-threaded: verificar + incrementar aqui é igualmente atômico.
  async eval(script, numKeys, ...args) {
    // Implementa o script Lua de estoque.js:
    //   se atual + pedir > total → retorna -1
    //   senão → INCRBY + EXPIRE → retorna novo total
    const key    = args[0];
    const total  = parseInt(args[1], 10);
    const pedir  = parseInt(args[2], 10);
    const ttlSec = parseInt(args[3], 10);

    const e     = this._ler(key);
    const atual = e ? parseInt(e.value, 10) : 0;

    if (atual + pedir > total) return -1;

    const novo = atual + pedir;
    this._store.set(key, { value: String(novo), expiresAt: Date.now() + ttlSec * 1000 });
    return novo;
  }
}

const redis = new RedisMock();
redis.on('connect', () => console.log('[Redis] Adaptador em memória ativo (sem servidor externo)'));

module.exports = redis;
