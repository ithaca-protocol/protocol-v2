import { TestEnv, makeSuite } from './helpers/make-suite';
import { deployCustomReserveInterestRateStrategy} from '../../helpers/contracts-deployments';

import { RAY } from '../../helpers/constants';

import { rateStrategyStableOne } from '../../markets/aave/rateStrategies';

import { strategyDAI } from '../../markets/aave/reservesConfigs';
import { AToken, CustomReserveInterestRateStrategy , MintableERC20 } from '../../types';
import BigNumber from 'bignumber.js';
import './helpers/utils/math';

const { expect } = require('chai');

makeSuite('Custom interest rate strategy tests', (testEnv: TestEnv) => {
  let strategyInstance: CustomReserveInterestRateStrategy;
  let dai: MintableERC20;
  let aDai: AToken;

  before(async () => {
    dai = testEnv.dai;
    aDai = testEnv.aDai;

    const { addressesProvider } = testEnv;

    strategyInstance = await deployCustomReserveInterestRateStrategy(
      [
        addressesProvider.address,
      ],
      false
    );
  });

  it('Checks rates at 0% utilization rate, empty reserve', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance['calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'](
      dai.address,
      aDai.address,
      0,
      0,
      0,
      0,
      0,
      strategyDAI.reserveFactor
    );

    expect(currentLiquidityRate.toString()).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039).times(RAY).toFixed(0),
      'Invalid stable rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      (50e23).toLocaleString('fullwide', {useGrouping:false}),
      'Invalid variable rate'
    );

  });

  it('Checks rates at 80% utilization rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance['calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'](
      dai.address,
      aDai.address,
      '200000000000000000',
      '0',
      '0',
      '800000000000000000',
      '0',
      strategyDAI.reserveFactor
    );

    const totalDebt = new BigNumber('800000000000000000');

    let availableLiquidity = await dai.balanceOf(aDai.address);

    availableLiquidity = availableLiquidity.add('200000000000000000'); // total liquidity = existing liquidity + added liquidity(200000000000000000) - taken liquidity(0)

    const utilizationRate = totalDebt.rayDiv(totalDebt.plus(availableLiquidity.toString()));

    const expectedVariableRate = new BigNumber(50e23).plus((new BigNumber(493e23)).rayMul(utilizationRate));

    const expectedLiquidityRate = utilizationRate.rayMul((utilizationRate.rayMul(new BigNumber(488e23)).plus(new BigNumber(55e23))));

    expect(currentLiquidityRate.toString()).to.be.equal(
    expectedLiquidityRate.toFixed(0).toString(),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039).times(RAY).plus(rateStrategyStableOne.stableRateSlope1).toFixed(0),
      'Invalid stable rate'
    );
  });

  it('Checks rates at 100% utilization rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance['calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'](
      dai.address,
      aDai.address,
      '0',
      '0',
      '0',
      '800000000000000000',
      '0',
      strategyDAI.reserveFactor
    );

    let availableLiquidity = await dai.balanceOf(aDai.address);

    const totalDebt = new BigNumber('800000000000000000');

    const utilizationRate = totalDebt.rayDiv(totalDebt.plus(availableLiquidity.toString()));

    const expectedVariableRate = new BigNumber(50e23).plus((new BigNumber(493e23)).rayMul(utilizationRate));

    const expectedLiquidityRate = utilizationRate.rayMul((utilizationRate.rayMul(new BigNumber(488e23)).plus(new BigNumber(55e23))));

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedLiquidityRate.toFixed(0),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039)
        .times(RAY)
        .plus(rateStrategyStableOne.stableRateSlope1)
        .plus(rateStrategyStableOne.stableRateSlope2)
        .toFixed(0),
      'Invalid stable rate'
    );
  });

  it('Checks rates at 100% utilization rate, 50% stable debt and 50% variable debt, with a 10% avg stable rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance['calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'](
      dai.address,
      aDai.address,
      '0',
      '0',
      '400000000000000000',
      '400000000000000000',
      '100000000000000000000000000',
      strategyDAI.reserveFactor
    );

    let availableLiquidity = await dai.balanceOf(aDai.address);

    const totalDebt = new BigNumber('800000000000000000');

    const utilizationRate = totalDebt.rayDiv(totalDebt.plus(availableLiquidity.toString()));

    const expectedVariableRate = new BigNumber(50e23).plus((new BigNumber(493e23)).rayMul(utilizationRate));

    const expectedLiquidityRate = utilizationRate.rayMul((utilizationRate.rayMul(new BigNumber(488e23)).plus(new BigNumber(55e23))));

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedLiquidityRate.toFixed(0),
      'Invalid liquidity rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039)
        .times(RAY)
        .plus(rateStrategyStableOne.stableRateSlope1)
        .plus(rateStrategyStableOne.stableRateSlope2)
        .toFixed(0),
      'Invalid stable rate'
    );
  });
});
