import https from 'https';
import fs from 'fs';
import { MongoError } from 'mongodb';
import expressApp from './app';
import { API_URL, PORT } from './config';
import { MongoDbConnector } from './config/oidc/adapter/mongodb';

const options = {
  key: fs.readFileSync('./certs/dev-key.pem'),
  cert: fs.readFileSync('./certs/cert.pem'),
};

/**
 * Creating HTTP server
 */
const server = https.createServer(options, expressApp);

const mongoConnector = new MongoDbConnector();

server.listen(PORT, () => {
  mongoConnector
    .init()
    .then((result) => {
      console.log('DB running, DB name: ', result.options.dbName);
      console.log(`Server listening on port ${PORT}`);
      console.log('Server available on this URI: ', API_URL);

    })
    .catch((err: MongoError) => {
      if (server.listening) {
        server.close();
      }
      throw new Error(`Failed to connect to the database.\nCause:${err}`);
    });
});
