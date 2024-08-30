import { eEthereumNetwork, iParamsPerNetwork } from './helpers/types';

require('dotenv').config();

const GWEI = 1000 * 1000 * 1000;

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.arbitrumSepolia]: `https://arbitrum-sepolia.blockpi.network/v1/rpc/public`,
};

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number> = {
  [eEthereumNetwork.hardhat]: 65 * GWEI,
  [eEthereumNetwork.arbitrumSepolia]: 3 * GWEI,
};

export const BLOCK_TO_FORK: iParamsPerNetwork<number | undefined> = {
  [eEthereumNetwork.hardhat]: undefined,
  [eEthereumNetwork.arbitrumSepolia]: undefined,
};
