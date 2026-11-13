import {readConfig} from './config.js';
import {createDb} from './db.js';
import {buildApp} from './app.js';

const config=readConfig();
const app=buildApp(config,createDb(config));
process.on('SIGTERM',()=>void app.close());
process.on('SIGINT',()=>void app.close());
await app.listen({port:config.port,host:config.host});
