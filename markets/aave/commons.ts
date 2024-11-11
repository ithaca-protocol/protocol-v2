import {
  oneRay,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneUsd,
} from '../../helpers/constants';
import { ICommonConfiguration, eEthereumNetwork } from '../../helpers/types';

// ----------------
// PROTOCOL GLOBAL PARAMS
// ----------------

export const CommonsConfig: ICommonConfiguration = {
  MarketId: 'Commons',
  ATokenNamePrefix: 'Aave interest bearing',
  StableDebtTokenNamePrefix: 'Aave stable debt bearing',
  VariableDebtTokenNamePrefix: 'Aave variable debt bearing',
  SymbolPrefix: '',
  ProviderId: 0, // Overriden in index.ts
  OracleQuoteCurrency: 'USD',
  OracleQuoteUnit: oneUsd.toString(),
  ProtocolGlobalParams: {
    TokenDistributorPercentageBase: '10000',
    MockUsdPriceInWei: '5848466240000000',
    UsdAddress: '0x10F7Fc1F91Ba351f9C629c5947AD69bD03C05b96',
    NilAddress: '0x0000000000000000000000000000000000000000',
    OneAddress: '0x0000000000000000000000000000000000000001',
    AaveReferral: '0',
  },

  // ----------------
  // COMMON PROTOCOL PARAMS ACROSS POOLS AND NETWORKS
  // ----------------

  Mocks: {
    AllAssetsInitialPrices: {
      ...MOCK_CHAINLINK_AGGREGATORS_PRICES,
    },
  },
  // TODO: reorg alphabetically, checking the reason of tests failing
  LendingRateOracleRatesCommon: {
    WETH: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    DAI: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    USDC: {
      borrowRate: oneRay.multipliedBy(0.039).toFixed(),
    },
    AAVE: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
    LINK: {
      borrowRate: oneRay.multipliedBy(0.03).toFixed(),
    },
  },
  // ----------------
  // COMMON PROTOCOL ADDRESSES ACROSS POOLS
  // ----------------

  // If PoolAdmin/emergencyAdmin is set, will take priority over PoolAdminIndex/emergencyAdminIndex
  PoolAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.arbitrumSepolia]: undefined,
    [eEthereumNetwork.arbitrum]: undefined,
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.arbitrumSepolia]: undefined,
    [eEthereumNetwork.arbitrum]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  LendingRateOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  LendingPoolCollateralManager: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  LendingPoolConfigurator: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  LendingPool: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  WethGateway: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  AaveOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: ZERO_ADDRESS,
    [eEthereumNetwork.arbitrum]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.arbitrumSepolia]: {
      WETH: '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165',
      USDC: '0x0153002d20B96532C639313c2d54c3dA09109309',
      USD: '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165',
    },
    [eEthereumNetwork.arbitrum]: {
      WETH: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
      USDC: '0x50834F3163758fcC1Df9973b6e91f0F0F0434aD3',
      USD: '0x639Fe6ab55C921f74e7fac1ee960C0B6293ba612',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.arbitrumSepolia]: {},
    [eEthereumNetwork.arbitrum]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.hardhat]:
      '0xbae024d959c6a022dc5ed37294cd39c141034b2ae5f02a955cce75c930a81bf5',
    [eEthereumNetwork.arbitrumSepolia]: '',
    [eEthereumNetwork.arbitrum]: '',
  },
  WETH: {
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.arbitrumSepolia]: '0xbF4864f3D55BbEFC14F2FD4Af8217184e6B6168B',
    [eEthereumNetwork.arbitrum]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.arbitrumSepolia]: '0xbF4864f3D55BbEFC14F2FD4Af8217184e6B6168B',
    [eEthereumNetwork.arbitrum]: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.hardhat]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.arbitrumSepolia]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.arbitrum]: '0xa5321067016FAD9f49fC9b4EEA145793b8BEB7c6',
  },
  IncentivesController: {
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.arbitrumSepolia]: ZERO_ADDRESS,
    [eEthereumNetwork.arbitrum]: ZERO_ADDRESS,
  },
};
