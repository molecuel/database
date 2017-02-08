'use strict';
import {singleton, di} from '@molecuel/di';
// import {MlclConfig} from '@molecuel/core';
import * as _ from 'lodash';
// import {IMlclDatabase} from './interfaces/IMlclDataBase';
export {IMlclDatabase} from './interfaces/IMlclDataBase';

@singleton
export class MlclDatabase {
  private _databases: any[] /*IMlclDatabase[]*/ = [];
  private _connections: any[] = [];
  constructor(config?: Object) {
    if(config && !_.isEmpty(config)) {
      this.addDbsFrom(config);
    }
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

  public addDbsFrom(config: Object) {
    this._databases.push(config);
  }

  public init() {
    for (let configElem of this._databases) {
      di.getInstance(configElem.name);
    }
  }

  public get connections() {
    return this.deepFreeze(this._connections);
  }
}
