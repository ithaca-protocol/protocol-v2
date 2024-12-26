import { eEthereumNetwork, iParamsPerNetwork } from './helpers/types';

require('dotenv').config();

const GWEI = 1000 * 1000 * 1000;

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.arbitrumSepolia]: `https://arb-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
  [eEthereumNetwork.arbitrum]: `https://arb-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
};

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number> = {
  [eEthereumNetwork.hardhat]: 65 * GWEI,
  [eEthereumNetwork.arbitrumSepolia]: 3 * GWEI,
  [eEthereumNetwork.arbitrum]: 0.1 * GWEI,
};

export const BLOCK_TO_FORK: iParamsPerNetwork<number | undefined> = {
  [eEthereumNetwork.hardhat]: undefined,
  [eEthereumNetwork.arbitrumSepolia]: undefined,
  [eEthereumNetwork.arbitrum]: undefined,
};
