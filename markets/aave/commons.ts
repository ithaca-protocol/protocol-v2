import {
  oneRay,
  ZERO_ADDRESS,
  MOCK_CHAINLINK_AGGREGATORS_PRICES,
  oneEther,
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
  OracleQuoteCurrency: 'ETH',
  OracleQuoteUnit: oneEther.toString(),
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
  },
  PoolAdminIndex: 0,
  EmergencyAdmin: {
    [eEthereumNetwork.hardhat]: undefined,
    [eEthereumNetwork.arbitrumSepolia]: undefined,
  },
  EmergencyAdminIndex: 1,
  ProviderRegistry: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  ProviderRegistryOwner: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  LendingRateOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  LendingPoolCollateralManager: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  LendingPoolConfigurator: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  LendingPool: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  WethGateway: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  TokenDistributor: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  AaveOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  FallbackOracle: {
    [eEthereumNetwork.hardhat]: '',
    [eEthereumNetwork.arbitrumSepolia]: ZERO_ADDRESS,
  },
  ChainlinkAggregator: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.arbitrumSepolia]: {
      USDC: '0x0153002d20B96532C639313c2d54c3dA09109309',
      USD: '0xd30e2101a97dcbAeBCBC04F14C3f624E67A35165',
    },
  },
  ReserveAssets: {
    [eEthereumNetwork.hardhat]: {},
    [eEthereumNetwork.arbitrumSepolia]: {},
  },
  ReservesConfig: {},
  ATokenDomainSeparator: {
    [eEthereumNetwork.hardhat]:
      '0xbae024d959c6a022dc5ed37294cd39c141034b2ae5f02a955cce75c930a81bf5',
    [eEthereumNetwork.arbitrumSepolia]: '',
  },
  WETH: {
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.arbitrumSepolia]: '0xbF4864f3D55BbEFC14F2FD4Af8217184e6B6168B',
  },
  WrappedNativeToken: {
    [eEthereumNetwork.hardhat]: '', // deployed in local evm
    [eEthereumNetwork.arbitrumSepolia]: '0xbF4864f3D55BbEFC14F2FD4Af8217184e6B6168B',
  },
  ReserveFactorTreasuryAddress: {
    [eEthereumNetwork.hardhat]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
    [eEthereumNetwork.arbitrumSepolia]: '0x464c71f6c2f760dda6093dcb91c24c39e5d6e18c',
  },
  IncentivesController: {
    [eEthereumNetwork.hardhat]: ZERO_ADDRESS,
    [eEthereumNetwork.arbitrumSepolia]: ZERO_ADDRESS,
  },
};
