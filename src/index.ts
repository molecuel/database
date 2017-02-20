'use strict';
import * as _ from 'lodash';
// import {MlclConfig} from '@molecuel/core';
import {singleton, di} from '@molecuel/di';
import {IMlclDatabase} from './interfaces/IMlclDatabase';
export {IMlclDatabase} from './interfaces/IMlclDatabase';
export const PERSISTENCE_LAYER = 'persistence';
export const POPULATION_LAYER = 'population';

@singleton
export class MlclDatabase {
  protected _configs: IMlclDatabase[];
  protected _connections: any[];

  public addDatabasesFrom(config: Object) {
    let databases: any[] = [];
    if(config && !_.isEmpty(config)) {
      for (let prop in config) {
        if (prop === 'database' || prop === 'databases') {
          if (_.isArray(config[prop])) {
            for (let database of config[prop]) {
              databases.push(database);
            }
          }
          else {
            databases.push(config[prop]);
          }
        }
        else if (typeof config[prop] === 'object' && typeof config[prop] !== 'function' && config[prop] !== null) {
          this.addDatabasesFrom(config[prop]);
        }
      }
    }
    if (databases.length && !this._configs) {
      this._configs = [];
    }
    this._configs = _.union(this._configs, databases);
  }

  public async init() {
    let connections: any[] = [];
    if (this._configs) {
      for (let database of this._configs) {
        if (database && database.type && ((<any>database).uri || (<any>database).url)) {
          let url = (<any>database).uri || (<any>database).url;
          let instance = di.getInstance(database.type, url);
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
      this._connections = connections;
    }
    else {
      this._connections = undefined;
    }
  }

  /**
   * Public rollback method
   * @param {Map<IMlclDatabase, Set<[any, string]>} data    [A map of connection-keys and [document, collection name]-sets]
   * @return {Promise<boolean|Error[]}                      [true on success; list of errors on failure]
   */
  public async rollback(data: Map<IMlclDatabase, Set<[any, string]>>): Promise<boolean|Error[]> {
    let result = {
      successCount: 0,
      errors: []
    };
    for (let [connection, query] of data) {
      try {
        await (<any>connection).save(...query);
        result.successCount++;
      } catch (error) {
        result.errors.push(error);
      }
    }
    if (!result.errors.length && result.successCount === data.size) {
      return Promise.resolve(true);
    }
    else {
      return Promise.reject(result.errors.length === 1 ? result.errors[0] : result.errors);
    }
  }

  public async save(document: any, collectionName?: string, rollbackOnError?: boolean): Promise<any> {
    if (rollbackOnError !== false) {
      rollbackOnError = true;
    }
    let result = {
      successCount: 0,
      errorCount: 0,
      errors: []
    };
    if (_.isEmpty(document)) {
      let rejection = new Error('Refused to save empty or undefined object.');
      delete rejection.stack;
      return Promise.reject(rejection);
    } else {
      let copy = _.cloneDeep(document);
      if (document.collection) {
        collectionName = document.collection;
        delete copy.collection;
      }
      let preSaveStates: Map<IMlclDatabase, any> = new Map();
      for (let connectionShell of this._connections) {
        let idPattern = connectionShell.connection.idPattern || connectionShell.connection.constructor.idPattern;
        if (rollbackOnError && collectionName) {
          let query = {};
          query[idPattern] = document.id || document._id;
          try {
            let result = await this.find(query, collectionName);
            if (_.isArray(result) && result.length) {
              if (result.length === 1) {
                preSaveStates.set(connectionShell.connection, new Set([result[0], collectionName]));
              }
              else {
                // oops! multiple hits for the same id!! and now?
                // for now, skip connection/do nothing
              }
            }
            else {
              // not found -> reset via query
              preSaveStates.set(connectionShell.connection, new Set([query, collectionName]));
            }
          } catch (error) {
            // db not reached?
            // do nothing
          }
        }
        try {
          copy[idPattern] = document.id || document._id;
          await connectionShell.connection.save(copy, collectionName);
          result.successCount++;
        } catch (error) {
          if (!collectionName) {
            return Promise.reject(error);
          }
          else if (rollbackOnError) {
            preSaveStates.delete(connectionShell.connection); // do not include current connection in rollback;
            try {
              if (await this.rollback(preSaveStates)) {
                let message = new Error('Save failed on one or more databases. Rollback successful.');
                delete message.stack;
                return Promise.reject(message);
              }
            } catch (error) {
              // error on rollback!
              let rejectReason = new Error('Save failed on one or more databases. Rollback failed!');
              delete rejectReason.stack;
              rejectReason['reason'] = error;
              return Promise.reject(rejectReason);
            }
          }
          result.errorCount++;
          result.errors.push(error);
        }
      }
      if (!result.successCount) {
        return Promise.reject(result);
      }
      else {
        return Promise.resolve(result);
      }
    }
  }

  public async find(query: Object, collectionName: string): Promise<any[] | Error> {
    try {
      let response = await this._connections[0].connection.find(query, collectionName);
      return Promise.resolve(response);
    } catch (error) {
      return Promise.reject(error);
    }
  }

  public async populate(document: any, properties: string[], collections: string[]): Promise<any> {
    if (!properties) {
      return Promise.resolve(document);
    }
    let successCount: number = 0;
    let buffer = {};
    let idPattern = this._connections[0].connection.idPattern ||this._connections[0].connection.constructor.idPattern;
    for (let index: number = 0; index < properties.length; index ++) {
      if (document[properties[index]]) {
        let response;
        let query = {};
        try {
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
                }
                else {
                  return entry;
                }
              });
              buffer[properties[index]] = response;
              successCount++;
            }
          }
          else {
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
    if (!successCount) {
      return Promise.reject(document);
    }
    else if (successCount < properties.length) {
      for (let prop in buffer) {
        document[prop] = buffer[prop];
      }
      return Promise.reject(document);
    }
    else {
      for (let prop in buffer) {
        document[prop] = buffer[prop];
      }
      return Promise.resolve(document);
    }
  }

  public get connections(): any[] {
    return this._connections ? _.map(this._connections, 'connection') : undefined;
  }

  public get configs(): IMlclDatabase[] {
    return this._configs;
  }

  public get persistenceDatabases(): MlclDatabase {
    let persDbs = _.filter(this._configs, (db) => {
      return (db && db.layer === PERSISTENCE_LAYER);
    });
    let persConn = _.filter(this._connections, (conn) => {
      return (conn && conn.layer === PERSISTENCE_LAYER);
    });
    return <MlclDatabase>this.deepFreeze(new MlclDatabaseSubset(persDbs, persConn));
  }

  public get populationDatabases(): MlclDatabase {
    let popuDbs = _.filter(this._configs, (db) => {
      return (db && db.layer === POPULATION_LAYER);
    });
    let popuConn = _.filter(this._connections, (conn) => {
      return (conn && conn.layer === POPULATION_LAYER);
    });
    return <MlclDatabase>this.deepFreeze(new MlclDatabaseSubset(popuDbs, popuConn));
  }

  protected deepFreeze(obj: Object, depth?: number) {
    if (typeof depth === 'undefined') {
      depth = 5;
    }
    let keys = Object.keys(obj);
    for (let prop in obj) {
      if (_.includes(keys, prop)) {
        if (depth > 0 && (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') && obj[prop] !== null && obj[prop] !== undefined) {
          depth--;
          this.deepFreeze(obj[prop], depth);
        }
      }
    }
    return Object.freeze(obj);
  }
}

class MlclDatabaseSubset extends MlclDatabase {
  constructor(databases: IMlclDatabase[], connections: any[] /*Map<string, any>*/) {
    super();
    this._configs = databases;
    this._connections = connections;
    // delete this.persistenceDatabases;
    // delete this.populationDatabases;
  }
}