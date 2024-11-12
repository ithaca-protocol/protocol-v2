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
    [eEthereumNetwork.arbitrum]: {
      USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
      WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    },
  },
};

export default AaveConfig;
