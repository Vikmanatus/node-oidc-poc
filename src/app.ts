import express, { Request } from 'express';
import morgan from 'morgan';
import { permissionConfig } from './config';
import { oidc_provider } from './config/oidc';
import { authRouter } from './routes';
import { BasicJsonResponse, GenericApiError, TypedResponse } from './types';
import { ROUTER_ENDPOINTS } from './types/postman';
import helmet from 'helmet';

import url from 'url';

/**
 * Global express application
 */
const app = express();

const directives = helmet.contentSecurityPolicy.getDefaultDirectives();

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives,
    },
  }),
);
/**
 * Used to display information about incoming HTTP requests in the terminal
 */
app.use(morgan('dev'));
// app.use(oidc.callback())
/**
 * Authorizing parsing of JSON body and URL encoded requests
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * The different other endpoints used in our API
 */
app.use(ROUTER_ENDPOINTS.AUTH, authRouter);

const prod = process.env.NODE_ENV === 'production';

if (prod) {
  app.enable('trust proxy');
  oidc_provider.proxy = true;
  app.use((req, res: TypedResponse<GenericApiError>, next) => {
    if (req.secure) {
      next();
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      const secured_url = 'https' + '://' + req.headers.host + req.originalUrl;
      res.redirect(secured_url);
    } else {
      res.status(400).json({
        error: 'invalid_request',
        success: false,
        message: 'do yourself a favor and only use https',
      });
    }
  });
}

app.use(oidc_provider.callback())


/**
 * Root API home
 */
app.get(permissionConfig.home.url, (_req: Request, res: TypedResponse<BasicJsonResponse>) => {
  return res.status(200).json({ message: 'Welcolme to nodejs-secured-api', success: true });
});

/**
 * Used to redirect user's in case of unexisting URL
 */
app.use((_req, res: TypedResponse<BasicJsonResponse>) => {
  res.status(404).json({
    message: 'Page not founded',
    success: false,
  });
});

export default app;
