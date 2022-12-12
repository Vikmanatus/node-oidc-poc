import { Db, MongoClient, MongoError } from 'mongodb';
import { MONGO_DB_URI } from '@/config';
import { Adapter, AdapterPayload } from 'oidc-provider';
const grantable = new Set([
  'access_token',
  'authorization_code',
  'refresh_token',
  'device_code',
  'backchannel_authentication_request',
]);

class CollectionSet extends Set {
  constructor() {
    super();
  }
  addItem(name: string, db: Db) {
    const nu = this.has(name);
    super.add(name);
    if (!nu) {
      db.collection(name)
        .createIndexes([
          ...(grantable.has(name)
            ? [
                {
                  key: { 'payload.grantId': 1 },
                },
              ]
            : []),
          ...(name === 'device_code'
            ? [
                {
                  key: { 'payload.userCode': 1 },
                  unique: true,
                },
              ]
            : []),
          ...(name === 'session'
            ? [
                {
                  key: { 'payload.uid': 1 },
                  unique: true,
                },
              ]
            : []),
          {
            key: { expiresAt: 1 },
            expireAfterSeconds: 0,
          },
        ])
        .catch(console.error); // eslint-disable-line no-console
    }
  }
}

class MongoAdapter implements Adapter {
  private name: string;
  protected database: Db | null;

  /**
   *
   * Creates an instance of MyAdapter for an oidc-provider model.
   *
   * @constructor
   * @param {string} name Name of the oidc-provider model. One of "Grant, "Session", "AccessToken",
   * "AuthorizationCode", "RefreshToken", "ClientCredentials", "Client", "InitialAccessToken",
   * "RegistrationAccessToken", "DeviceCode", "Interaction", "ReplayDetection",
   * "BackchannelAuthenticationRequest", or "PushedAuthorizationRequest"
   *
   */
  constructor(name: string) {
    this.name = name;
    this.database = null;
    // NOTE: you should never be creating indexes at runtime in production, the following is in
    //   place just for demonstration purposes of the indexes required
    // collections.add(this.name);
  }
  async find(id: string): Promise<void | AdapterPayload | undefined> {
    const result = await this.database
      ?.collection(this.name)
      .find(
        { _id: id },
        //{ payload: 1 },
      )
      .limit(1)
      .next();

    if (!result) return undefined;
    return result.payload;
  }
  async upsert(_id: string, payload: AdapterPayload, expiresIn: number): Promise<void | undefined> {
    let expiresAt: Date | null = null;

    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }
    if (this.database) {
      await this.database
        .collection(this.name)
        .updateOne({ _id }, { $set: { payload, ...(expiresAt ? { expiresAt } : undefined) } }, { upsert: true });
    }
  }
  async consume(id: string): Promise<void | undefined> {
    await this.database
      ?.collection(this.name)
      .findOneAndUpdate({ _id: id }, { $set: { 'payload.consumed': Math.floor(Date.now() / 1000) } });
  }
  async findByUid(uid: string): Promise<void | AdapterPayload | undefined> {
    const result = await this.database
      ?.collection(this.name)
      .find(
        { 'payload.uid': uid },
        // { payload: 1 },
      )
      .limit(1)
      .next();

    if (!result) return undefined;
    return result.payload;
  }
  async destroy(id: string): Promise<void | undefined> {
    await this.database?.collection(this.name).deleteOne({ _id: id });
  }
  async revokeByGrantId(grantId: string): Promise<void | undefined> {
    await this.database?.collection(this.name).deleteMany({ 'payload.grantId': grantId });
  }

  async findByUserCode(userCode: string): Promise<void | AdapterPayload | undefined> {
    const result = await this.database
      ?.collection(this.name)
      .find(
        { 'payload.userCode': userCode },
        //{ payload: 1 }
      )
      .limit(1)
      .next();
    if (!result) {
      return undefined;
    }
    return result.payload;
  }
  init(): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      MongoClient.connect(MONGO_DB_URI)
        .then((result) => {
          this.database = result.db();
          const collections = new CollectionSet();
          collections.addItem(this.name, this.database);
          resolve(result);
        })
        .catch((err: MongoError) => {
          reject(err);
        });
    });
  }
}

export const initialConnection = ():Promise<MongoClient> => {
  return new Promise((resolve, reject) => {
    MongoClient.connect(MONGO_DB_URI)
      .then((result) => {
        resolve(result);
      })
      .catch((err: MongoError) => {
        reject(err);
      });
  });
}

export { MongoAdapter };
