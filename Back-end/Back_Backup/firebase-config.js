const admin = require('firebase-admin');
require('dotenv').config();

// Configurar credenciais usando variáveis de ambiente
const serviceAccount = {
  type: process.env.type || 'service_account',
  project_id: process.env.project_id || process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.private_key_id,
  private_key: process.env.private_key ? process.env.private_key.replace(/\\n/g, '\n') : undefined,
  client_email: process.env.client_email,
  client_id: process.env.client_id,
  auth_uri: process.env.auth_uri || 'https://accounts.google.com/o/oauth2/auth',
  token_uri: process.env.token_uri || 'https://oauth2.googleapis.com/token',
  auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url || 'https://www.googleapis.com/oauth2/v1/certs',
  client_x509_cert_url: process.env.client_x509_cert_url,
  universe_domain: process.env.universe_domain || 'googleapis.com'
};

// Inicializar Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: process.env.project_id || process.env.FIREBASE_PROJECT_ID || 'climapp-a5e2d'
  });
}

const auth = admin.auth();

module.exports = {
  auth,
  admin
};