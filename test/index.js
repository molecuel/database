'use strict';
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
require("reflect-metadata");
const should = require("should");
const di_1 = require("@molecuel/di");
const core_1 = require("@molecuel/core");
const dist_1 = require("../dist");
should();
let config = {};
describe('MlclDatabase', function () {
    before(() => {
        di_1.di.bootstrap(core_1.MlclCore);
    });
    let dbHandler;
    describe('init', () => {
        it('should be possible to load the database config', () => {
            try {
                dbHandler = di_1.di.getInstance('MlclDatabase');
                should.exist(dbHandler);
                dbHandler.should.be.instanceOf(dist_1.MlclDatabase);
                dbHandler.addDbsFrom(config);
            }
            catch (error) {
                should.not.exist(error);
            }
        });
        it('should be possible to init all configured Database interfaces', () => {
            try {
                dbHandler.init();
            }
            catch (error) {
                should.not.exist(error);
            }
        });
        it('should be possible to access the database connections', () => {
            try {
                let connections = dbHandler.connections;
                should.exist(connections);
            }
            catch (error) {
                should.not.exist(error);
            }
        });
    });
    describe('interaction', () => {
        let Car = class Car {
            static get collection() { return 'cars'; }
        };
        Car = __decorate([
            di_1.injectable
        ], Car);
        let car = di_1.di.getInstance('Car');
        car.id = 1;
        car.make = 'C4';
        car.engine = 'V6';
        car.gearbox = '5gear';
        it('should be possible to load the database config', () => {
            try {
                dbHandler = di_1.di.getInstance('MlclDatabase');
                should.exist(dbHandler);
                dbHandler.should.be.instanceOf(dist_1.MlclDatabase);
                dbHandler.addDbsFrom(config);
            }
            catch (error) {
                should.not.exist(error);
            }
        });
        it('should be possible to init all configured Database interfaces', () => {
            try {
                dbHandler.init();
            }
            catch (error) {
                should.not.exist(error);
            }
        });
        it('should be possible to access the database connections', () => {
            try {
                let connections = dbHandler.connections;
                should.exist(connections);
            }
            catch (error) {
                should.not.exist(error);
            }
        });
        it('should be possible to store data in persistence layer', () => __awaiter(this, void 0, void 0, function* () {
            try {
                let response = yield dbHandler.persistenceDatabases.save(car);
                should.exist(response);
            }
            catch (error) {
                should.not.exist(error);
            }
        }));
        it('should be possible to read data from the persistence layer', () => __awaiter(this, void 0, void 0, function* () {
            try {
                let response = yield dbHandler.persistenceDatabases.find({ _id: car.id });
                should.exist(response);
            }
            catch (error) {
                should.not.exist(error);
            }
        }));
        it('should be possible to populate data', () => __awaiter(this, void 0, void 0, function* () {
            try {
                let response = yield dbHandler.populationDatabases.populate(car, ['engine', 'gearbox']);
                should.exist(response);
            }
            catch (error) {
                should.not.exist(error);
            }
        }));
        it('should be possible to store and populate data in the population layer', () => __awaiter(this, void 0, void 0, function* () {
            try {
                let response = yield dbHandler.populationDatabases.save(car);
                should.exist(response);
            }
            catch (error) {
                should.not.exist(error);
            }
        }));
        it('should be possible to read data from the population layer', () => __awaiter(this, void 0, void 0, function* () {
            try {
                let response = yield dbHandler.populationDatabases.find({ _id: car.id });
                should.exist(response);
            }
            catch (error) {
                should.not.exist(error);
            }
        }));
    });
});
