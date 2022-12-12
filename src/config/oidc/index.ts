import { Configuration, Provider } from 'oidc-provider';
import { cookies_keys } from '../index';
import { MongoAdapter } from './adapter/mongodb';

const configuration: Configuration = {
  cookies: {
    keys: cookies_keys,
  },
  features: { devInteractions: { enabled: false } },
  adapter:MongoAdapter
  // refer to the documentation for other available configuration
};

const oidc = new Provider('http://localhost:5050', configuration);
console.log({ oidc });
