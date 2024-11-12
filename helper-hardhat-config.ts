import { eEthereumNetwork, iParamsPerNetwork } from './helpers/types';

require('dotenv').config();

const GWEI = 1000 * 1000 * 1000;

export const NETWORKS_RPC_URL: iParamsPerNetwork<string> = {
  [eEthereumNetwork.hardhat]: 'http://localhost:8545',
  [eEthereumNetwork.arbitrumSepolia]: `https://arbitrum-sepolia.infura.io/v3/c351135c3bb54a779bf258ea5f1077d6`,
  [eEthereumNetwork.arbitrum]: `https://arbitrum.llamarpc.com`,
};

export const NETWORKS_DEFAULT_GAS: iParamsPerNetwork<number> = {
  [eEthereumNetwork.hardhat]: 65 * GWEI,
  [eEthereumNetwork.arbitrumSepolia]: 3 * GWEI,
  [eEthereumNetwork.arbitrum]: 1 * GWEI,
};

export const BLOCK_TO_FORK: iParamsPerNetwork<number | undefined> = {
  [eEthereumNetwork.hardhat]: undefined,
  [eEthereumNetwork.arbitrumSepolia]: undefined,
  [eEthereumNetwork.arbitrum]: undefined,
};
