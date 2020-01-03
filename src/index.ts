import SlsOffline from 'serverless-offline';
import SlsDotEnv from 'serverless-dotenv-plugin';
import SlsTypescript from 'serverless-plugin-typescript';
import Serverless from 'serverless';

import SlsTypescriptApi from './plugin';

export default class ServerlessPlugin {

  constructor(private serverless: Serverless, private options: Serverless.Options) {
    this.serverless.pluginManager.addPlugin(SlsOffline);
    this.serverless.pluginManager.addPlugin(SlsDotEnv);
    this.serverless.pluginManager.addPlugin(SlsTypescript);
    this.serverless.pluginManager.addPlugin(SlsTypescriptApi);
  }

}

module.exports = ServerlessPlugin;
