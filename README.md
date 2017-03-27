[![NPM version][npm-image]][npm-url] [![Build Status][travis-image]][travis-url] [![Coverage percentage][coveralls-image]][coveralls-url]

[npm-image]: https://badge.fury.io/js/%40molecuel%2Fdatabase.svg
[npm-url]: https://npmjs.org/package/@molecuel/database
[travis-image]: https://travis-ci.org/molecuel/database.svg?branch=master
[travis-url]: https://travis-ci.org/molecuel/database
[daviddm-image]: https://david-dm.org/molecuel/database.svg?theme=shields.io
[daviddm-url]: https://david-dm.org/molecuel/database
[coveralls-image]: https://coveralls.io/repos/molecuel/database/badge.svg
[coveralls-url]: https://coveralls.io/r/molecuel/database

# Database module for molecuel framework

@molecuel/database is a general database management module, able to  manage all database libraries or classes adhering to the IMlclDatabase interface definition and made injectable via @molecuel/di.
It's initialization is based on the @molecuel/di dependency injection module and it exists as a singleton.

## Initialization

To use it, simply include its import in the di's bootstrap and get the singleton instance by name.
You can then add configurations based on any object with respective properties and connect to databases.

```js
import { di } from '@molecuel/di';
import { MlclCore } from '@molecuel/core';
import { MlclDatabase } from '@molecuel/database';

di.bootstrap(MlclCore, MlclDatabase);

let dbHandler = di.getInstance('MlclDatabase');
let config = {
  database: {
    name: 'mongodb_pers',
    type: 'MlclMongoDb',
    uri: 'mongodb://localhost/mongodb_persistence_test',
    layer: PERSISTENCE_LAYER,
    idPattern: '_id'
  }
};

dbHandler.addDatabasesFrom(config);
async () => {
  dbHandler.init();
}();
  
```

## Handling connected databases
