import { task } from 'hardhat/config';
import { ConfigNames, getEmergencyAdmin, loadPoolConfig } from '../../helpers/configuration';
import { checkVerification } from '../../helpers/etherscan-verification';
import { printContracts } from '../../helpers/misc-utils';
import { getLendingPoolConfiguratorProxy } from '../../helpers/contracts-getters';

task('full:deploy', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, DRE) => {
    const POOL_NAME = ConfigNames.IthacaArbitrum;
    await DRE.run('set-DRE');

    await DRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Deployment started\n');

    console.log('0. Deploy address provider registry');
    await DRE.run('full:deploy-address-provider-registry', { verify, pool: POOL_NAME });

    console.log('1. Deploy address provider');
    await DRE.run('full:deploy-address-provider', { verify, pool: POOL_NAME });

    console.log('2. Deploy lending pool');
    await DRE.run('full:deploy-lending-pool', { verify, pool: POOL_NAME });

    console.log('3. Deploy oracles');
    await DRE.run('full:deploy-oracles', { verify, pool: POOL_NAME });

    console.log('4. Deploy Data Provider');
    await DRE.run('full:data-provider', { pool: POOL_NAME });

    console.log('5. Deploy WETH Gateway');
    await DRE.run('full-deploy-weth-gateway', { pool: POOL_NAME });

    console.log('6. Initialize lending pool');
    await DRE.run('full:initialize-lending-pool', { verify, pool: POOL_NAME });

    console.log('7. Deploy UI helpers');
    await DRE.run('deploy-UiPoolDataProviderV2V3', { verify });
    await DRE.run('deploy-UiIncentiveDataProviderV2V3', { verify });

    const poolConfig = loadPoolConfig(POOL_NAME);
    const emergencyAdmin = await DRE.ethers.getSigner(await getEmergencyAdmin(poolConfig));
    const poolConfigurator = await getLendingPoolConfiguratorProxy();
    await poolConfigurator.connect(emergencyAdmin).setPoolPause(false);
    console.log('Finished deployment, unpaused protocol');

    console.log('\nFinished deployment');
    printContracts();
  });
