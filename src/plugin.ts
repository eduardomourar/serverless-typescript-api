import * as fs from 'fs-extra';
import * as path from 'path';
import Serverless from 'serverless';
import SlsPlugin from 'serverless/classes/Plugin';
import SlsService from 'serverless/classes/Service';

const BUILD_FOLDER = '.build';

export default class SlsTypescriptApi implements SlsPlugin {

  public hooks = {
    'after:package:createDeploymentArtifacts': this.cleanup.bind(this),
    'after:deploy:function:packageFunction': this.cleanup.bind(this),
    'after:run:run': this.cleanup.bind(this),
    'package:setupProviderConfiguration': this.compileResources.bind(this),
  };

  private servicePath: string;
  private provider: string;
  private config: any;

  constructor(private serverless: Serverless, private options: Serverless.Options) {
    this.provider = 'aws';
    this.servicePath = this.serverless.config.servicePath;
    this.pluginConfig();
  }

  private async pluginConfig() {
    this.config = this.serverless.service.custom['serverless-typescript-api'] || {};
    this.debug('Adding plugin to Serverless framework...');
    this.debug(`Plugin custom config: ${JSON.stringify(this.config)}`);
    this.serverless.setProvider(this.provider, this.serverless.getProvider(this.provider));
    const slsService: SlsService = this.serverless.service;
    const region: string = slsService.provider.region;

    this.debug('Injecting default config and plugins...');

    const plugins: string[] = slsService['plugins'] || [];
    this.debug(`Original plugins: ${JSON.stringify(plugins)}`);

    slsService.update({
      provider: {
        name: this.provider,
        runtime: 'nodejs12.x',
        versionFunctions: false,
        environment: {
          REGION: `${region}`,
        },
        ...slsService.provider,
      },
    });
  }

  public async compileResources(): Promise<void> {
    this.debug('Preparing package with defaults...');
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    // Construct CF resources
    this.addApiGatewayCorsSupport(resources);
    this.debug(`Modified CloudFormation: ${JSON.stringify(resources)}`);
  }

  private addApiGatewayCorsSupport(resources: object): void {
    // This response is needed for custom authorizer failures cors support
    Object.assign(resources, {
      GatewayResponse: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
          },
          ResponseType: 'EXPIRED_TOKEN',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
          StatusCode: '401',
        },
      },
      AuthFailureGatewayResponse: {
        Type: 'AWS::ApiGateway::GatewayResponse',
        Properties: {
          ResponseParameters: {
            'gatewayresponse.header.Access-Control-Allow-Origin': "'*'",
            'gatewayresponse.header.Access-Control-Allow-Headers': "'*'",
          },
          ResponseType: 'UNAUTHORIZED',
          RestApiId: {
            Ref: 'ApiGatewayRestApi',
          },
          StatusCode: '401',
        },
      },
    });
  }

  async cleanup(): Promise<void> {
    // Remove temp build folder
    fs.removeSync(path.join(this.servicePath, BUILD_FOLDER));
  }

  public log(msg, prefix = 'INFO[serverless-typescript-api]: ') {
    this.serverless.cli.log.call(this.serverless.cli, prefix + msg);
  }

  public debug(msg, context?: string) {
    if (this.config.debug || process.env['SLS_DEBUG']) {
      if (context) {
        this.log(msg, `DEBUG[serverless-typescript-api][${context}]: `);
      } else {
        this.log(msg, 'DEBUG[serverless-typescript-api]: ');
      }
    }
  }

}

module.exports = SlsTypescriptApi;
