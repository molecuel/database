"use strict";
import {IMlclDatabase} from "@molecuel/core";
import {di, singleton} from "@molecuel/di";
import * as _ from "lodash";
import {IMlclDbResult} from "./interfaces/IMlclDbResult";

export const PERSISTENCE_LAYER = "persistence";
export const POPULATION_LAYER = "population";

@singleton
export class MlclDatabase {
  protected ownConfigs: IMlclDatabase[];
  protected ownConnections: any[];

  /**
   * Register database configurations from any object, resolving existing "database" or "databases" properties
   *
   * @param {Object} config - The object to resolve the database configurations from
   *
   * @memberOf MlclDatabase
   */
  public addDatabasesFrom(config: Object) {
    let databases: any[] = [];
    if (config && !_.isEmpty(config)) {
      // loop over object or array properties
      for (let prop in config) {
        // check for relevant property
        if (prop === "database" || prop === "databases") {
          if (_.isArray(config[prop])) {
            for (let database of config[prop]) {
              databases.push(database);
            }
          } else {
            databases.push(config[prop]);
          }
        // check for sub-objects to resolve
        } else if (typeof config[prop] === "object" && typeof config[prop] !== "function" && config[prop] !== null) {
          this.addDatabasesFrom(config[prop]);
        }
      }
    }
    if (databases.length && !this.ownConfigs) {
      this.ownConfigs = [];
    }
    this.ownConfigs = _.union(this.ownConfigs, databases);
  }

  /**
   * Initialize connections based on restistered configurations
   *
   * @memberOf MlclDatabase
   */
  public async init() {
    let connections: any[] = [];
    if (this.ownConfigs) {
      for (let database of this.ownConfigs) {
        if (database && database.type && ((<any> database).uri || (<any> database).url)) {
          let url = (<any> database).uri || (<any> database).url;
          let instance = di.getInstance(database.type, url);
          if (database.idPattern && instance) {
            Object.defineProperty(instance, "idPattern", {
              get(): string {
                return database.idPattern;
              // tslint:disable-next-line:trailing-comma
              }
            });
          }
          try {
            await instance.connect();
            connections.push({layer: database.layer, connection: instance});
          } catch (error) {
            // console.log(error);
          }
        }
      }
    }
    if (connections.length) {
      this.ownConnections = connections;
    } else {
      this.ownConnections = undefined;
    }
  }

  /**
   * Applies rollback query to respective connection
   *
   * @param {Map<IMlclDatabase, Set<[any, string, boolean]>>} data - Map of connection keys and
   * document-collection-upsert sets
   * @returns {(Promise<boolean|Error[]>)}
   * @memberOf MlclDatabase
   */
  public async rollback(data: Map<IMlclDatabase, Set<[any, string, boolean]>>): Promise<boolean|Error[]> {
    let result: IMlclDbResult = {
      errorCount: 0,
      errors: [],
      successCount: 0 };
    for (let [connection, query] of data) {
      try {
        await (<any> connection).save(...query);
        result.successCount++;
      } catch (error) {
        result.errorCount++;
        result.errors.push(error);
      }
    }
    if (!result.errors.length && result.successCount === data.size) {
      return Promise.resolve(true);
    } else {
      return Promise.reject(result.errors);
    }
  }

  /**
   * Saves a single document to a collection on all connected databases
   *
   * @param {*} document - the document to save
   * @param {string} [collectionName] - the collection to save the document to
   * @param {boolean} [upsert=true] - whether to insert new document
   * @param {boolean} [rollbackOnError=true] - whether to execute rollback on any failing save
   * @returns {Promise<any>}
   *
   * @memberOf MlclDatabase
   */
  // tslint:disable-next-line:max-line-length
  public async save(document: any, collectionName?: string, upsert: boolean = true, rollbackOnError: boolean = true): Promise<any> {
    return new Promise(async (resolve, reject) => {
      let result: IMlclDbResult = {
        errorCount: 0,
        errors: [],
        successCount: 0,
        successes: [] };
      if (_.isEmpty(document)) {
        let rejection = new Error("Refused to save empty or undefined object.");
        delete rejection.stack;
        reject(rejection);
      } else if (!this.ownConnections) {
        let rejection = new Error("No active connections.");
        delete rejection.stack;
        reject(rejection);
      } else {
        let copy = _.cloneDeep(document);
        if (document.collection || document.constructor.collection) {
          collectionName = document.collection || document.constructor.collection;
          delete copy.collection;
        }
        let preSaveStates: Map<IMlclDatabase, any> = new Map();
        for (let connectionShell of this.ownConnections) {
          // check for active connection
          if (connectionShell.connection) {
            let idPattern = connectionShell.connection.idPattern || connectionShell.connection.constructor.idPattern;
            if (rollbackOnError && collectionName) {
              let query = {};
              query[idPattern] = document.id || document._id;
              // gather document states pre save
              try {
                let response = await this.find(query, collectionName);
                if (_.isArray(response) && response.length) {
                  if (response.length === 1) {
                    preSaveStates.set(connectionShell.connection, new Set([response[0], collectionName, upsert]));
                  } else {
                    // oops! multiple hits for the same id!! and now?
                    // for now, skip connection/do nothing
                  }
                } else {
                  // not found -> reset via query
                  preSaveStates.set(connectionShell.connection, new Set([query, collectionName, false]));
                }
              } catch (error) {
                // db not reached?
                // do nothing
              }
            }
            // save document
            try {
              copy[idPattern] = document.id || document._id;
              let saved = await connectionShell.connection.save(copy, collectionName, upsert);
              result.successCount++;
              result.successes.push(saved);
            } catch (error) {
              if (!collectionName) {
                reject(error);
              } else if (rollbackOnError) {
                // do not include current connection in rollback;
                preSaveStates.delete(connectionShell.connection);
                try {
                  await this.rollback(preSaveStates);
                  let message = new Error("Save failed on one or more databases. Rollback successful.");
                  delete message.stack;
                  reject(message);
                } catch (error) {
                  // error on rollback!
                  let rejectReason = new Error("Save failed on one or more databases. Rollback failed!");
                  delete rejectReason.stack;
                  (<any> rejectReason).reason = error;
                  reject(rejectReason);
                }
              }
              result.errorCount++;
              result.errors.push(error);
            }
          }
        }
        if (!result.successCount) {
          reject(result);
        } else {
          resolve(result);
        }
      }
    });
  }

  /**
   * Find document in collection of the first connection by query
   *
   * @param {Object} query
   * @param {string} collectionName
   * @returns {(Promise<any[] | Error>)}
   *
   * @memberOf MlclDatabase
   */
  public async find(query: Object, collectionName: string): Promise<any[]> {
    try {
      let response = await this.ownConnections[0].connection.find(query, collectionName);
      return Promise.resolve(response);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  /**
   * Populate a given document's properties in supplied collections via find operation
   *
   * @param {*} document - The document to populate
   * @param {string[]} properties - The properties to populate
   * @param {string[]} collections - The collections to populate from
   * @returns {Promise<any>}
   *
   * @memberOf MlclDatabase
   */
  public async populate(document: any, properties: string[], collections: string[]): Promise<any> {
    if (!properties || !properties.length) {
      // no properties to populate; return unmodified document
      return Promise.resolve(document);
    } else if (!this.ownConnections[0].connection) {
      let rejection = new Error("Primary connection inactive.");
      delete rejection.stack;
      return Promise.reject(rejection);
    }
    let successCount: number = 0;
    let buffer = {};
    let idPattern = this.ownConnections[0].connection.idPattern
      || this.ownConnections[0].connection.constructor.idPattern;
    // iterate over requested properties
    for (let index: number = 0; index < properties.length; index ++) {
      // check for requested property existing on document
      if (document[properties[index]]) {
        let response;
        let query = {};
        try {
          // check if property is array of references
          if (_.isArray(document[properties[index]])) {
            query[idPattern] = {$in: document[properties[index]]};
            response = await this.find(query, collections[index]);
            if (response && _.isArray(response) && response.length) {
              // map response items to current document items
              response = _.map(document[properties[index]], (entry) => {
                let responseHit = _.find(response, (item) => {
                  return _.isEqual(item[idPattern], entry);
                });
                if (responseHit) {
                  return responseHit;
                } else {
                  return entry;
                }
              });
              buffer[properties[index]] = response;
              successCount++;
            }
          } else {
          // requested property is single reference
            query[idPattern] = document[properties[index]];
            response = await this.find(query, collections[index]);
            if (response[0]) {
              buffer[properties[index]] = response[0];
              successCount++;
            }
          }
        } catch (error) {
          // console.log(error);
          // continue;
        }
      }
    }
    // result management
    if (!successCount) {
      return Promise.reject(document);
    } else if (successCount < properties.length) {
      for (let prop in buffer) {
        if (document[prop]) {
          document[prop] = buffer[prop];
        }
      }
      return Promise.reject(document);
    } else {
      for (let prop in buffer) {
        if (buffer[prop]) {
          document[prop] = buffer[prop];
        }
      }
      return Promise.resolve(document);
    }
  }

  /**
   * Array of available connections
   *
   * @readonly
   * @type {any[]}
   * @memberOf MlclDatabase
   */
  public get connections(): any[] {
    return this.ownConnections ? _.map(this.ownConnections, "connection") : undefined;
  }

  /**
   * Array of registered configurations
   *
   * @readonly
   * @type {IMlclDatabase[]}
   * @memberOf MlclDatabase
   */
  public get configs(): IMlclDatabase[] {
    return this.ownConfigs;
  }

  /**
   * Subset; only connected databases registered as persistence layer
   *
   * @readonly
   * @type {MlclDatabase}
   * @memberOf MlclDatabase
   */
  public get persistenceDatabases(): MlclDatabase {
    let persDbs = _.filter(this.ownConfigs, (db) => {
      return (db && db.layer === PERSISTENCE_LAYER);
    });
    let persConn = _.filter(this.ownConnections, (conn) => {
      return (conn && conn.layer === PERSISTENCE_LAYER);
    });
    return <MlclDatabase> this.deepFreeze(new MlclDatabaseSubset(persDbs, persConn));
  }

  /**
   * Subset; only connected databases registered as population layer
   *
   * @readonly
   * @type {MlclDatabase}
   * @memberOf MlclDatabase
   */
  public get populationDatabases(): MlclDatabase {
    let popuDbs = _.filter(this.ownConfigs, (db) => {
      return (db && db.layer === POPULATION_LAYER);
    });
    let popuConn = _.filter(this.ownConnections, (conn) => {
      return (conn && conn.layer === POPULATION_LAYER);
    });
    return <MlclDatabase> this.deepFreeze(new MlclDatabaseSubset(popuDbs, popuConn));
  }

  /**
   * Set and return the given object as readonly (with given depth)
   *
   * @protected
   * @param {Object} obj - The object to set as readonly
   * @param {number} [depth=5] - The maximum depth to apply the readonly status to
   * @returns {Object} The readonly object
   *
   * @memberOf MlclDatabase
   */
  protected deepFreeze(obj: Object, depth: number = 5): Object {
    let keys = Object.keys(obj);
    for (let prop in obj) {
      if (_.includes(keys, prop)) {
        if (depth > 0
          && (typeof obj[prop] === "object" || typeof obj[prop] === "function")
          && obj[prop] !== null
          && obj[prop] !== undefined) {

          depth--;
          this.deepFreeze(obj[prop], depth);
        }
      }
    }
    return Object.freeze(obj);
  }
}

/**
 * Represents a subset of databases
 *
 * @class MlclDatabaseSubset
 * @extends {MlclDatabase}
 */
// tslint:disable-next-line:max-classes-per-file
class MlclDatabaseSubset extends MlclDatabase {
  constructor(databases: IMlclDatabase[], connections: any[] /*Map<string, any>*/) {
    super();
    this.ownConfigs = databases;
    this.ownConnections = connections;
    // delete this.persistenceDatabases;
    // delete this.populationDatabases;
  }
}
