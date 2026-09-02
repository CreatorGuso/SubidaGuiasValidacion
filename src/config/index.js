require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,

  db: {
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERT === 'true',
    },
  },

  sunat: {
    clientId: process.env.SUNAT_CLIENT_ID,
    clientSecret: process.env.SUNAT_CLIENT_SECRET,
    ruc: process.env.SUNAT_RUC,
    usuarioSol: process.env.SUNAT_USUARIO_SOL,
    claveSol: process.env.SUNAT_CLAVE_SOL,
    apiBase: 'https://api-cpe.sunat.gob.pe/v1',
    seguridadBase: 'https://api-seguridad.sunat.gob.pe/v1',
    scope: 'https://api-cpe.sunat.gob.pe',
  },

  certificates: {
    dir: process.env.CERTIFICATES_DIR || './certificates',
  },

  rutas: {
    documentos: process.env.RUTA_DOCUMENTOS || '../DOCUMENTOS/',
    imagenes: process.env.RUTA_IMAGENES || '../IMAGENES/',
  },
};
