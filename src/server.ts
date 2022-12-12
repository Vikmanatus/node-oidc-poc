import http from 'http';
import { MongoClient, MongoError } from 'mongodb';
import expressApp from './app';
import { PORT } from './config';
import { initialConnection, MongoAdapter } from './config/oidc/adapter/mongodb';
/**
 * Creating HTTP server
 */
const server = http.createServer(expressApp);

server.listen(PORT, () => {
  return initialConnection()
    .then((result) => {
      console.log(result.options.dbName);
      console.log(`Server listening on port ${PORT}`);
    })
    .catch((err: MongoError) => {
      throw new Error(`failed to start server.\nCause:${err}`);
    });
});
