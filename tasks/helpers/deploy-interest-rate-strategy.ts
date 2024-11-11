import { task } from 'hardhat/config';
import { eEthereumNetwork } from '../../helpers/types';
import * as marketConfigs from '../../markets/aave';
import * as reserveConfigs from '../../markets/aave/reservesConfigs';
import { getLendingPoolAddressesProvider } from './../../helpers/contracts-getters';
import { deployDefaultReserveInterestRateStrategy } from './../../helpers/contracts-deployments';
import { setDRE } from '../../helpers/misc-utils';

const LENDING_POOL_ADDRESS_PROVIDER = {
  main: '0xb53c1a33016b2dc2ff3653530bff1848a515c8c5',
  kovan: '0x652B2937Efd0B5beA1c8d54293FC1289672AFC6b',
};

const isSymbolValid = (symbol: string, network: eEthereumNetwork) =>
  Object.keys(reserveConfigs).includes('strategy' + symbol) &&
  marketConfigs.AaveConfig.ReserveAssets[network][symbol] &&
  marketConfigs.AaveConfig.ReservesConfig[symbol] === reserveConfigs['strategy' + symbol];

task('external:deploy-interest-rate-strategy', 'Deploy interest rate strategy')
  .addParam('symbol', `Asset symbol, needs to have configuration ready`)
  .addFlag('verify', 'Verify contracts at Etherscan')
  .setAction(async ({ verify, symbol }, localBRE) => {
    const network = localBRE.network.name;
    if (!isSymbolValid(symbol, network as eEthereumNetwork)) {
      throw new Error(
        `
WRONG RESERVE ASSET SETUP:
        The symbol ${symbol} has no reserve Config and/or reserve Asset setup.
        update /markets/aave/index.ts and add the asset address for ${network} network
        update /markets/aave/reservesConfigs.ts and add parameters for ${symbol}
        `
      );
    }
    setDRE(localBRE);
    const strategyParams = reserveConfigs['strategy' + symbol];
    const addressProvider = await getLendingPoolAddressesProvider(
      LENDING_POOL_ADDRESS_PROVIDER[network]
    );
    const rates = await deployDefaultReserveInterestRateStrategy(
      [
        addressProvider.address,
        strategyParams.strategy.optimalUtilizationRate,
        strategyParams.strategy.baseVariableBorrowRate,
        strategyParams.strategy.variableRateSlope1,
        strategyParams.strategy.variableRateSlope2,
        strategyParams.strategy.stableRateSlope1,
        strategyParams.strategy.stableRateSlope2,
      ],
      verify
    );
    console.log(`
    New interest rate strategy deployed on ${network}:
    Strategy Implementation for ${symbol} address: ${rates.address}
    `);
  });
