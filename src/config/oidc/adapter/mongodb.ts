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

class MongoDbConnector {
  protected database: Db | null;
  constructor() {
    this.database = null;
  }

  /**
   * Connect the application to your MongoDb database
   * @returns {Promise<MongoClient>} A promise containing the connected MongoDb client
   */
  init(): Promise<MongoClient> {
    return new Promise((resolve, reject) => {
      MongoClient.connect(MONGO_DB_URI)
        .then((result) => {
          this.database = result.db();
          resolve(result);
        })
        .catch((err: MongoError) => {
          reject(err);
        });
    });
  }
}
class NodeOidcAdapter extends MongoDbConnector implements Adapter {
  protected name: string;

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
    super();
    this.name = name;
    const collections = new CollectionSet();
    if (this.database) {
      collections.addItem(this.name, this.database);
    }
  }

  /**
   *
   * Update or Create an instance of an oidc-provider model.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier that oidc-provider will use to reference this model instance for
   * future operations.
   * @param {object} payload Object with all properties intended for storage.
   * @param {integer} expiresIn Number of seconds intended for this model to be stored.
   *
   */
  async upsert(id: string, payload: AdapterPayload, expiresIn: number): Promise<void | undefined> {
    let expiresAt: Date | null = null;

    if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    }
    if (this.database) {
      await this.database
        .collection(this.name)
        .updateOne({ _id: id }, { $set: { payload, ...(expiresAt ? { expiresAt } : undefined) } }, { upsert: true });
    }
  }

  /**
   *
   * Return previously stored instance of an oidc-provider model.
   *
   * @return {Promise} Promise fulfilled with what was previously stored for the id (when found and
   * not dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  async find(id: string): Promise<void | AdapterPayload | undefined> {
    if (!this.database) {
      return;
    }
    const result = await this.database
      .collection(this.name)
      .find(
        { _id: id },
        //{ payload: 1 },
      )
      .limit(1)
      .next();

    if (!result) return undefined;
    return result.payload;
  }

  /**
   *
   * Return previously stored instance of DeviceCode by the end-user entered user code. You only
   * need this method for the deviceFlow feature
   *
   * @return {Promise} Promise fulfilled with the stored device code object (when found and not
   * dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   * @param {string} userCode the user_code value associated with a DeviceCode instance
   *
   */
  async findByUserCode(userCode: string): Promise<void | AdapterPayload | undefined> {
    if (!this.database) {
      return;
    }
    const result = await this.database
      .collection(this.name)
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

  /**
   *
   * Return previously stored instance of Session by its uid reference property.
   *
   * @return {Promise} Promise fulfilled with the stored session object (when found and not
   * dropped yet due to expiration) or falsy value when not found anymore. Rejected with error
   * when encountered.
   * @param {string} uid the uid value associated with a Session instance
   *
   */
  async findByUid(uid: string): Promise<void | AdapterPayload | undefined> {
    if (!this.database) {
      return;
    }
    const result = await this.database
      .collection(this.name)
      .find(
        { 'payload.uid': uid },
        // { payload: 1 },
      )
      .limit(1)
      .next();

    if (!result) return undefined;
    return result.payload;
  }

  /**
   *
   * Mark a stored oidc-provider model as consumed (not yet expired though!). Future finds for this
   * id should be fulfilled with an object containing additional property named "consumed" with a
   * truthy value (timestamp, date, boolean, etc).
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  async consume(id: string): Promise<void | undefined> {
    if (!this.database) {
      return;
    }
    await this.database
      .collection(this.name)
      .findOneAndUpdate({ _id: id }, { $set: { 'payload.consumed': Math.floor(Date.now() / 1000) } });
  }

  /**
   *
   * Destroy/Drop/Remove a stored oidc-provider model. Future finds for this id should be fulfilled
   * with falsy values.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} id Identifier of oidc-provider model
   *
   */
  async destroy(id: string): Promise<void | undefined> {
    if (!this.database) {
      return;
    }
    await this.database.collection(this.name).deleteOne({ _id: id });
  }

  /**
   *
   * Destroy/Drop/Remove a stored oidc-provider model by its grantId property reference. Future
   * finds for all tokens having this grantId value should be fulfilled with falsy values.
   *
   * @return {Promise} Promise fulfilled when the operation succeeded. Rejected with error when
   * encountered.
   * @param {string} grantId the grantId value associated with a this model's instance
   *
   */
  async revokeByGrantId(grantId: string): Promise<void | undefined> {
    if (!this.database) {
      return;
    }
    await this.database.collection(this.name).deleteMany({ 'payload.grantId': grantId });
  }
}


export { NodeOidcAdapter, MongoDbConnector };
