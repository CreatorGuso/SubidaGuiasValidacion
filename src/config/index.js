const path = require('path');
const dotenv = require('dotenv');

// Raíz del proyecto (dos niveles arriba de src/config). Todo se resuelve
// desde aquí para que el proceso sea independiente del directorio desde el
// que se ejecute node (src\, la raíz, un .bat, el programador de tareas...).
const RAIZ = path.resolve(__dirname, '..', '..');

dotenv.config({ path: path.join(RAIZ, '.env') });

// Convierte una ruta relativa del .env en absoluta respecto de la raíz.
const _dir = (valor, porDefecto) => path.resolve(RAIZ, valor || porDefecto);

module.exports = {
  // BD central (admin): contiene Conexiones y spPyOValidaGuia
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

  // Endpoints de SUNAT (fijos). Las credenciales se leen de cada ERP:
  // ruc/usuariosol/clavesol de v_empresas y client_id/client_secret de
  // tablas_empresas (idcodigo 700014 / 700013).
  sunat: {
    apiBase: 'https://api-cpe.sunat.gob.pe/v1',
    seguridadBase: 'https://api-seguridad.sunat.gob.pe/v1',
    scope: 'https://api-cpe.sunat.gob.pe',
    consultaIntentos: parseInt(process.env.SUNAT_CONSULTA_INTENTOS) || 20,
    consultaEspera: parseInt(process.env.SUNAT_CONSULTA_ESPERA) || 3000,
  },

  certificates: {
    dir: _dir(process.env.CERTIFICATES_DIR, './certificates'),
  },

  // Reporte de guías pendientes con su motivo de fallo. Se sobrescribe en
  // cada ejecución, así que solo contiene lo pendiente del día.
  reporte: {
    dir: _dir(process.env.REPORTE_DIR, './reportes'),
    archivo: process.env.REPORTE_ARCHIVO || 'pendientes.json',
  },
};