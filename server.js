
"use strict";

require("dotenv").config();

const express = require("express");
const { Pool } = require("pg");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const UPLOADS = path.join(ROOT, "uploads");
const isProduction = process.env.NODE_ENV === "production";

fs.mkdirSync(UPLOADS, { recursive: true });

// NEON ONLINE OU POSTGRESQL LOCAL
const databaseUrl = process.env.DATABASE_URL?.trim();

const pool = databaseUrl
  ? new Pool({
      connectionString: databaseUrl,
      max: 10,
      connectionTimeoutMillis: 15000,
      idleTimeoutMillis: 30000
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: Number(process.env.DB_PORT || 5432),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === "true"
        ? { rejectUnauthorized: true }
        : undefined
    });

if (!process.env.SESSION_SECRET ||
    process.env.SESSION_SECRET.length < 32) {
  throw new Error(
    "Define SESSION_SECRET com pelo menos 32 caracteres."
  );
}

if (isProduction) {
  app.set("trust proxy", 1);
}

app.disable("x-powered-by");

app.use(express.json({ limit: "100kb" }));
app.use(express.urlencoded({
  extended: false,
  limit: "100kb"
}));

app.use(session({
  store: new PgSession({
    pool,
    tableName: "user_sessions",
    createTableIfMissing: true
  }),
  name: "adm_folder.sid",
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    maxAge: 8 * 60 * 60 * 1000
  }
}));

function adminOnly(req, res, next) {
  if (req.session?.adminId) return next();

  return res.status(401).json({
    erro: "Inicia sessão como administrador."
  });
}

function sameOrigin(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    return next();
  }

  const origin = req.get("origin");
  const host = req.get("host");

  if (origin) {
    try {
      if (new URL(origin).host !== host) {
        return res.status(403).json({
          erro: "Origem não autorizada."
        });
      }
    } catch {
      return res.sendStatus(403);
    }
  } else if (req.get("sec-fetch-site") === "cross-site") {
    return res.sendStatus(403);
  }

  next();
}

app.use("/api", sameOrigin);

// LOGIN ADMINISTRATIVO
app.post("/api/admin/login", async (req, res) => {
  try {
    const username = String(req.body.username || "");
    const password = String(req.body.password || "");

    if (username.length > 100 || password.length > 200) {
      return res.status(400).json({
        erro: "Dados inválidos."
      });
    }

    const result = await pool.query(
      `SELECT id, password_hash
       FROM administradores
       WHERE username = $1`,
      [username]
    );

    const fallbackHash =
      "$2b$12$wA8DKR.XWXRZ0PSG2Lh3Oe7UK6YyCclQQO0pSX7du7Q6L3bDlqVRW";

    const hash = result.rows[0]?.password_hash || fallbackHash;
    const valid = await bcrypt.compare(password, hash);

    if (!result.rows.length || !valid) {
      return res.status(401).json({
        erro: "Utilizador ou palavra-passe incorretos."
      });
    }

    req.session.regenerate(err => {
      if (err) {
        return res.status(500).json({
          erro: "Erro ao iniciar sessão."
        });
      }

      req.session.adminId = result.rows[0].id;

      req.session.save(err => {
        if (err) {
          return res.status(500).json({
            erro: "Erro ao guardar sessão."
          });
        }

        res.json({ sucesso: true });
      });
    });
  } catch (err) {
    console.error("Login:", err.message);
    res.status(500).json({ erro: "Erro no servidor." });
  }
});

app.get("/api/admin/me", (req, res) => {
  res.json({
    autenticado: Boolean(req.session?.adminId)
  });
});

app.post("/api/admin/logout", adminOnly, (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({
        erro: "Erro ao terminar sessão."
      });
    }

    res.clearCookie("adm_folder.sid");
    res.json({ sucesso: true });
  });
});

// COLEÇÕES PÚBLICAS
app.get("/api/colecoes", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM colecoes
       WHERE publicado = TRUE
       ORDER BY id`
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Coleções:", err.message);
    res.status(500).json({
      erro: "Erro ao carregar coleções."
    });
  }
});

// COLEÇÕES ADMINISTRATIVAS
app.get("/api/admin/colecoes", adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM colecoes ORDER BY id"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      erro: "Erro ao carregar coleções."
    });
  }
});

function validateCollection(body) {
  const nome = String(body.nome || "").trim();
  const descricao = String(body.descricao || "").trim();
  const preco = Number(body.preco);
  const preco_antigo = Number(body.preco_antigo);
  const etiqueta1 = String(body.etiqueta1 || "").trim();
  const etiqueta2 = String(body.etiqueta2 || "").trim();

  if (
    !nome ||
    nome.length > 200 ||
    descricao.length > 10000 ||
    etiqueta1.length > 100 ||
    etiqueta2.length > 100 ||
    !Number.isFinite(preco) ||
    preco <= 0 ||
    preco > 99999999 ||
    !Number.isFinite(preco_antigo) ||
    preco_antigo < 0 ||
    preco_antigo > 99999999
  ) {
    throw new Error("Dados da coleção inválidos.");
  }

  return {
    nome,
    descricao,
    preco,
    preco_antigo,
    etiqueta1,
    etiqueta2,
    popular: body.popular === true,
    novo: body.novo === true,
    publicado: body.publicado !== false
  };
}

// CRIAR COLEÇÃO
app.post("/api/admin/colecoes", adminOnly, async (req, res) => {
  try {
    const c = validateCollection(req.body);

    const result = await pool.query(
      `INSERT INTO colecoes
       (nome, descricao, preco, preco_antigo,
        etiqueta1, etiqueta2, popular, novo, publicado)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        c.nome, c.descricao, c.preco,
        c.preco_antigo, c.etiqueta1,
        c.etiqueta2, c.popular,
        c.novo, c.publicado
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// EDITAR COLEÇÃO
app.put("/api/admin/colecoes/:id", adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const c = validateCollection(req.body);

    const result = await pool.query(
      `UPDATE colecoes SET
       nome=$1, descricao=$2, preco=$3,
       preco_antigo=$4, etiqueta1=$5,
       etiqueta2=$6, popular=$7,
       novo=$8, publicado=$9
       WHERE id=$10 RETURNING *`,
      [
        c.nome, c.descricao, c.preco,
        c.preco_antigo, c.etiqueta1,
        c.etiqueta2, c.popular,
        c.novo, c.publicado, id
      ]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        erro: "Coleção não encontrada."
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ erro: err.message });
  }
});

// ELIMINAR COLEÇÃO
app.delete("/api/admin/colecoes/:id", adminOnly, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!Number.isSafeInteger(id) || id < 1) {
      return res.status(400).json({
        erro: "ID inválido."
      });
    }

    const result = await pool.query(
      "DELETE FROM colecoes WHERE id=$1 RETURNING id",
      [id]
    );

    if (!result.rows.length) {
      return res.status(404).json({
        erro: "Coleção não encontrada."
      });
    }

    res.json({ sucesso: true });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({
      erro: "Erro ao eliminar coleção."
    });
  }
});

// UPLOAD TEMPORÁRIO LOCAL
// Na hospedagem, substituir por armazenamento persistente.
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS),

  filename: (req, file, cb) => {
    const extensions = {
      "image/jpeg": ".jpg",
      "image/png": ".png",
      "image/webp": ".webp",
      "video/mp4": ".mp4",
      "video/webm": ".webm"
    };

    const ext = extensions[file.mimetype];

    if (!ext) {
      return cb(new Error("Formato não permitido."));
    }

    cb(null, crypto.randomUUID() + ext);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter(req, file, cb) {
    const allowed = [
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm"
    ];

    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Formato não permitido."));
    }

    cb(null, true);
  }
});

function uploadFile(req, res, next) {
  upload.single("ficheiro")(req, res, err => {
    if (err) {
      return res.status(400).json({
        erro: err.message
      });
    }

    next();
  });
}

app.post(
  "/api/admin/colecoes/:id/upload/:tipo",
  adminOnly,
  uploadFile,
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const tipo = req.params.tipo;

      if (
        !Number.isSafeInteger(id) ||
        id < 1 ||
        !["imagem", "video"].includes(tipo)
      ) {
        throw new Error("Pedido inválido.");
      }

      if (!req.file) {
        throw new Error("Seleciona um ficheiro.");
      }

      const isImage = req.file.mimetype.startsWith("image/");

      if ((tipo === "imagem") !== isImage) {
        throw new Error("Tipo de ficheiro incorreto.");
      }

      const fd = fs.openSync(req.file.path, "r");
      const header = Buffer.alloc(16);

      try {
        fs.readSync(fd, header, 0, 16, 0);
      } finally {
        fs.closeSync(fd);
      }

      const jpg =
        header.subarray(0, 3).toString("hex") === "ffd8ff";

      const png =
        header.subarray(0, 8).toString("hex") ===
        "89504e470d0a1a0a";

      const webp =
        header.toString("ascii", 0, 4) === "RIFF" &&
        header.toString("ascii", 8, 12) === "WEBP";

      const mp4 =
        header.toString("ascii", 4, 8) === "ftyp";

      const webm =
        header.toString("hex", 0, 4) === "1a45dfa3";

      const valid = {
        "image/jpeg": jpg,
        "image/png": png,
        "image/webp": webp,
        "video/mp4": mp4,
        "video/webm": webm
      }[req.file.mimetype];

      if (!valid) {
        throw new Error("Conteúdo do ficheiro inválido.");
      }

      const url = "/uploads/" + req.file.filename;

      const result = await pool.query(
        `UPDATE colecoes SET ${tipo}=$1
         WHERE id=$2 RETURNING *`,
        [url, id]
      );

      if (!result.rows.length) {
        throw new Error("Coleção não encontrada.");
      }

      res.json(result.rows[0]);
    } catch (err) {
      if (req.file?.path) {
        fs.rm(req.file.path, { force: true }, () => {});
      }

      res.status(400).json({
        erro: err.message
      });
    }
  }
);

// FICHEIROS PÚBLICOS
app.get(
  ["/admin", "/admin/", "/admin/index.html"],
  (req, res) => {
    res.sendFile(path.join(ROOT, "admin", "index.html"));
  }
);

app.use("/css", express.static(path.join(ROOT, "css")));
app.use("/js", express.static(path.join(ROOT, "js")));
app.use("/images", express.static(path.join(ROOT, "images")));
app.use("/videos", express.static(path.join(ROOT, "videos")));
app.use("/uploads", express.static(UPLOADS));

app.get(["/", "/index.html"], (req, res) => {
  res.sendFile(path.join(ROOT, "index.html"));
});

app.use((req, res) => {
  res.status(404).send("Página não encontrada.");
});

// INICIALIZAR BASE DE DADOS
async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS administradores (
      id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS colecoes (
      id INTEGER GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
      nome VARCHAR(200) NOT NULL,
      descricao TEXT DEFAULT '',
      preco NUMERIC(10,2) NOT NULL DEFAULT 40.00,
      preco_antigo NUMERIC(10,2) DEFAULT 60.00,
      etiqueta1 VARCHAR(100) DEFAULT 'Digital Collection',
      etiqueta2 VARCHAR(100) DEFAULT 'Video Preview',
      imagem TEXT,
      video TEXT,
      popular BOOLEAN DEFAULT FALSE,
      novo BOOLEAN DEFAULT FALSE,
      publicado BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const username = process.env.ADMIN_BOOTSTRAP_USER;
  const password = process.env.ADMIN_BOOTSTRAP_PASSWORD;

  if (username && password) {
    if (password.length < 12) {
      throw new Error(
        "A palavra-passe admin precisa de 12 caracteres."
      );
    }

    const count = await pool.query(
      "SELECT COUNT(*)::int AS total FROM administradores"
    );

    if (count.rows[0].total === 0) {
      const hash = await bcrypt.hash(password, 12);

      await pool.query(
        `INSERT INTO administradores
         (username, password_hash)
         VALUES ($1,$2)`,
        [username, hash]
      );

      console.log("Administrador inicial criado.");
    }
  }
}

// ARRANCAR SERVIDOR
async function start() {
  try {
    await pool.query("SELECT 1");
    await initDatabase();

    app.listen(PORT, () => {
      console.log("================================");
      console.log("       ADM FOLDER ONLINE");
      console.log("================================");
      console.log(
        databaseUrl
          ? "Neon PostgreSQL conectado!"
          : "PostgreSQL local conectado!"
      );
      console.log(`Loja: http://localhost:${PORT}`);
      console.log(`Admin: http://localhost:${PORT}/admin`);
    });
  } catch (err) {
    console.error("Erro ao iniciar:", err.message);
    process.exit(1);
  }
}

start();
