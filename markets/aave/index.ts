import { IAaveConfiguration, eEthereumNetwork } from '../../helpers/types';

import { CommonsConfig } from './commons';
import {
  strategyAAVE,
  strategyDAI,
  strategyLINK,
  strategyUSDC,
  strategyWETH,
} from './reservesConfigs';

// ----------------
// POOL--SPECIFIC PARAMS
// ----------------

export const AaveConfig: IAaveConfiguration = {
  ...CommonsConfig,
  MarketId: 'Aave genesis market',
  ProviderId: 1,
  ReservesConfig: {
    AAVE: strategyAAVE,
    DAI: strategyDAI,
    LINK: strategyLINK,
    USDC: strategyUSDC,
    WETH: strategyWETH,
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.arbitrumSepolia]: {
      USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
      WETH: '0xbF4864f3D55BbEFC14F2FD4Af8217184e6B6168B',
    },
  },
};

export default AaveConfig;
