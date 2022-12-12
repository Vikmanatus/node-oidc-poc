import http from 'http';
import { MongoError } from 'mongodb';
import expressApp from './app';
import { PORT } from './config';
import { MongoDbConnector } from './config/oidc/adapter/mongodb';
/**
 * Creating HTTP server
 */
const server = http.createServer(expressApp);

const mongoConnector = new MongoDbConnector();

server.listen(PORT, () => {
  mongoConnector
    .init()
    .then((result) => {
      console.log('DB name: ', result.options.dbName);
      console.log(`Server listening on port ${PORT}`);
      console.log(process.env.NODE_ENV);
    })
    .catch((err: MongoError) => {
      if (server.listening) {
        server.close();
      }
      throw new Error(`Failed to connect to the database.\nCause:${err}`);
    });
});
