'use strict';
import 'reflect-metadata';
import should = require('should');
import assert = require('assert');
import {di, injectable} from '@molecuel/di';
import {MlclCore} from '@molecuel/core';
import {MlclDatabase} from '../dist';
import {Subject, Observable} from '@reactivex/rxjs';
should();

let config: any = {};

describe('MlclDatabase', function() {
  before(() => {
    di.bootstrap(MlclCore);
  });
  let dbHandler;
  describe('init', () => {
    it('should be possible to load the database config', () => {
      try {
        dbHandler = di.getInstance('MlclDatabase');
        should.exist(dbHandler);
        dbHandler.should.be.instanceOf(MlclDatabase);
        dbHandler.addDbsFrom(config);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to init all configured Database interfaces', () => {
      try {
        dbHandler.init();
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to access the database connections', () => {
      try {
        let connections = dbHandler.connections;
        should.exist(connections);
      } catch (error) {
        should.not.exist(error);
      }
    });
  }); // category end
  describe('interaction', () => {
    @injectable
    class Car {
      static get collection() { return 'cars'; }
    }
    let car = di.getInstance('Car');
    car.id = 1;
    car.make = 'C4';
    car.engine = 'V6';
    car.gearbox = '5gear';
    it('should be possible to load the database config', () => {
      try {
        dbHandler = di.getInstance('MlclDatabase');
        should.exist(dbHandler);
        dbHandler.should.be.instanceOf(MlclDatabase);
        dbHandler.addDbsFrom(config);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to init all configured Database interfaces', () => {
      try {
        dbHandler.init();
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to access the database connections', () => {
      try {
        let connections = dbHandler.connections;
        should.exist(connections);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to store data in persistence layer', async () => {
      try {
        let response = await dbHandler.persistenceDatabases.save(car);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to read data from the persistence layer', async () => {
      try {
        let response = await dbHandler.persistenceDatabases.find({_id: car.id});
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to populate data', async () => {
      try {
        let response = await dbHandler.populationDatabases.populate(car, ['engine', 'gearbox']);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to store and populate data in the population layer', async () => {
      try {
        let response = await dbHandler.populationDatabases.save(car);
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
    it('should be possible to read data from the population layer', async () => {
      try {
        let response = await dbHandler.populationDatabases.find({_id: car.id});
        should.exist(response);
      } catch (error) {
        should.not.exist(error);
      }
    });
  }); // category end
}); // test end
