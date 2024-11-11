import path from 'path';
import fs from 'fs';
import { HardhatUserConfig } from 'hardhat/types';
import { accounts } from './test-wallets.js';
import { eEthereumNetwork, eNetwork } from './helpers/types';
import { NETWORKS_RPC_URL, NETWORKS_DEFAULT_GAS } from './helper-hardhat-config';

require('dotenv').config();

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-waffle';
import '@nomiclabs/hardhat-etherscan';

import 'hardhat-gas-reporter';
import 'hardhat-typechain';
import 'solidity-coverage';

const SKIP_LOAD = process.env.SKIP_LOAD === 'true';
const DEFAULT_BLOCK_GAS_LIMIT = 80000000;
const DEFAULT_GAS_MUL = 10;
const HARDFORK = 'istanbul';
const ETHERSCAN_KEY = process.env.ETHERSCAN_KEY || '';
const MNEMONIC_PATH = "m/44'/60'/0'/0";
const MNEMONIC = process.env.MNEMONIC || '';
const UNLIMITED_BYTECODE_SIZE = process.env.UNLIMITED_BYTECODE_SIZE === 'true';

// Prevent to load scripts before compilation and typechain
if (!SKIP_LOAD) {
  [
    'misc',
    'migrations',
    'dev',
    'full',
    'verifications',
    'deployments',
    'helpers',
    'operations',
  ].forEach((folder) => {
    const tasksPath = path.join(__dirname, 'tasks', folder);
    fs.readdirSync(tasksPath)
      .filter((pth) => pth.includes('.ts'))
      .forEach((task) => {
        require(`${tasksPath}/${task}`);
      });
  });
}

require(`${path.join(__dirname, 'tasks/misc')}/set-bre.ts`);

const getCommonNetworkConfig = (networkName: eNetwork, networkId: number) => ({
  url: NETWORKS_RPC_URL[networkName],
  hardfork: HARDFORK,
  blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
  gasMultiplier: DEFAULT_GAS_MUL,
  gasPrice: NETWORKS_DEFAULT_GAS[networkName],
  chainId: networkId,
  accounts: {
    mnemonic: MNEMONIC,
    path: MNEMONIC_PATH,
    initialIndex: 0,
    count: 20,
  },
});

const buidlerConfig: HardhatUserConfig = {
  solidity: {
    version: '0.6.12',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      evmVersion: 'istanbul',
    },
  },
  typechain: {
    outDir: 'types',
    target: 'ethers-v5',
  },
  etherscan: {
    apiKey: {
      polygonMumbai: process.env.ETHERSCAN_POLYGON_KEY || '',
      goerli: process.env.ETHERSCAN_KEY || '',
      fuji: process.env.ETHERSCAN_SNOWTRACE_KEY || '',
      mainnet: process.env.ETHERSCAN_KEY || '',
      polygon: process.env.ETHERSCAN_POLYGON_KEY || '',
      avalanche: process.env.ETHERSCAN_SNOWTRACE_KEY || '',
    },
  },

  mocha: {
    timeout: 0,
  },
  networks: {
    arbitrumSepolia: getCommonNetworkConfig(eEthereumNetwork.arbitrumSepolia, 421614),
    arbitrum: getCommonNetworkConfig(eEthereumNetwork.arbitrum, 42161),
    hardhat: {
      hardfork: 'berlin',
      blockGasLimit: DEFAULT_BLOCK_GAS_LIMIT,
      gas: DEFAULT_BLOCK_GAS_LIMIT,
      gasPrice: 8000000000,
      allowUnlimitedContractSize: UNLIMITED_BYTECODE_SIZE,
      throwOnTransactionFailures: true,
      throwOnCallFailures: true,
      accounts: accounts.map(({ secretKey, balance }: { secretKey: string; balance: string }) => ({
        privateKey: secretKey,
        balance,
      })),
    },
  },
};

export default buidlerConfig;
