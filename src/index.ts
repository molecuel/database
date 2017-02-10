'use strict';
import * as _ from 'lodash';
// import {MlclConfig} from '@molecuel/core';
import {singleton, di} from '@molecuel/di';
import {IMlclDatabase} from './interfaces/IMlclDataBase';
export {IMlclDatabase} from './interfaces/IMlclDataBase';
export const PERSISTENCE_LAYER = 'persistence';
export const POPULATION_LAYER = 'population';

@singleton
export class MlclDatabase {
  protected _databases: IMlclDatabase[] = [];
  protected _connections: any[] = []; // Map<string, any> = new Map();

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
    this._databases = _.union(this._databases, databases);
  }

  public async init() {
    let connections: any[] = [];
    for (let database of this._databases) {
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
    this._connections = connections;
  }

  public async save(document: any, collectionName?: string): Promise<any> {
    let result = {
      successCount: 0,
      errorCount: 0,
      errors: []
    };
    let copy = _.cloneDeep(document);
    if (document.collection) {
      collectionName = document.collection;
      delete copy.collection;
    }
    for (let connectionShell of this._connections) {
      try {
        await connectionShell.connection.save(copy, collectionName);
        result.successCount++;
      } catch (error) {
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
    for (let index: number = 0; index < properties.length; index ++) {
      if (document[properties[index]]) {
        let response;

        try {
          if (_.isArray(document[properties[index]])) {
            response = await this.find({_id: {$in: document[properties[index]]}}, collections[index]);
            if (response && response.length) {
              buffer[properties[index]] = response; // todo: filter responseItems to documentPropertyItems
              // if (response.length === document[properties[index]].length) {
              successCount++;
              // }
            }
          }
          else {
            response = await this.find({_id: document[properties[index]]}, collections[index]);
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
    return _.map(this._connections, 'connection');
  }

  public get persistenceDatabases(): MlclDatabase {
    let persDbs = _.filter(this._databases, (db) => {
      return (db && db.layer === PERSISTENCE_LAYER);
    });
    let persConn = _.filter(this._connections, (conn) => {
      return (conn && conn.layer === PERSISTENCE_LAYER);
    });
    return <MlclDatabase>this.deepFreeze(new MlclDatabaseSubset(persDbs, persConn));
  }

  public get populationDatabases(): MlclDatabase {
    let popuDbs = _.filter(this._databases, (db) => {
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
    this._databases = databases;
    this._connections = connections;
    // delete this.persistenceDatabases;
    // delete this.populationDatabases;
  }
}