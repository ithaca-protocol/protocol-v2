import { task } from 'hardhat/config';
import { ConfigNames } from '../../helpers/configuration';
import { checkVerification } from '../../helpers/etherscan-verification';
import { printContracts } from '../../helpers/misc-utils';

task('full:deploy', 'Deploy development enviroment')
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify }, localBRE) => {
    const POOL_NAME = ConfigNames.Aave;

    await localBRE.run('set-DRE');

    // Prevent loss of gas verifying all the needed ENVs for Etherscan verification
    if (verify) {
      checkVerification();
    }

    console.log('Migration started\n');

    // console.log('1. Deploy tokens');
    // await localBRE.run('dev:deploy-mock-tokens', { verify });

    console.log('2. Deploy address provider');
    await localBRE.run('full:deploy-address-provider-registry', { verify, pool: POOL_NAME});
    await localBRE.run('full:deploy-address-provider', { verify, pool: POOL_NAME });

    console.log('3. Deploy lending pool');
    await localBRE.run('full:deploy-lending-pool', { verify, pool: POOL_NAME });

    console.log('4. Deploy oracles');
    await localBRE.run('full:deploy-oracles', { verify, pool: POOL_NAME });

    console.log('6. Initialize lending pool');
    await localBRE.run('full:initialize-lending-pool', { verify, pool: POOL_NAME });

    console.log('\nFinished deployment');
    printContracts();
  });
