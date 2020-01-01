import * as fs from 'fs-extra';
import * as path from 'path';
import Serverless from 'serverless';
import Plugin from 'serverless/classes/Plugin';
import slsOffline from 'serverless-offline';
import slsDotEnv from 'serverless-dotenv-plugin';
import slsTypescript from 'serverless-plugin-typescript';

const BUILD_FOLDER = '.build';

export class ServerlessPlugin implements Plugin {

  public hooks = {
    'after:invoke:local:invoke': this.cleanup.bind(this),
    'after:invoke:invoke': this.cleanup.bind(this),
    'after:package:createDeploymentArtifacts': this.cleanup.bind(this),
    'after:deploy:function:packageFunction': this.cleanup.bind(this),
    'after:run:run': this.cleanup.bind(this),
    'package:setupProviderConfiguration': this.compileResources.bind(this),
  };

  private servicePath: string;

  constructor(private serverless: Serverless, private options: Serverless.Options) {
    this.servicePath = this.serverless.config.servicePath;
    this.pluginConfig();
  }

  private async pluginConfig() {
    this.serverless.cli.log(`Adding plugin to Serverless config: ${JSON.stringify(this.options)}`);
    this.serverless.setProvider('aws', this.serverless.getProvider('aws'));
    const slsService = this.serverless.service;
    const region = slsService.provider.region;
    slsService.custom
    slsService.update({
      provider: {
        runtime: 'nodejs12.x',
        versionFunctions: false,
        environment: {
          REGION: `${region}`,
        },
        ...slsService.provider,
      },
      
    });
    this.serverless.pluginManager.addPlugin(slsOffline);
    this.serverless.pluginManager.addPlugin(slsDotEnv);
    this.serverless.pluginManager.addPlugin(slsTypescript);
  }

  public async compileResources(): Promise<void> {
    const resources = this.serverless.service.provider.compiledCloudFormationTemplate.Resources;

    // Construct CF resources
    this.addApiGatewayCorsSupport(resources);
    this.serverless.cli.log(`Modified CloudFormation: ${JSON.stringify(resources)}`);
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

}

module.exports = ServerlessPlugin;
