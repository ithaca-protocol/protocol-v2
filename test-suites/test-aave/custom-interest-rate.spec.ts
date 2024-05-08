import { TestEnv, makeSuite } from './helpers/make-suite';
import { getSigners } from '../../helpers/misc-utils';
import { deployCustomReserveInterestRateStrategy } from '../../helpers/contracts-deployments';

import { RAY } from '../../helpers/constants';

import { rateStrategyStableOne } from '../../markets/aave/rateStrategies';

import { strategyDAI } from '../../markets/aave/reservesConfigs';
import { AToken, CustomReserveInterestRateStrategy, MintableERC20 } from '../../types';
import BigNumber from 'bignumber.js';
import './helpers/utils/math';

const { expect } = require('chai');

makeSuite('Custom interest rate strategy tests', (testEnv: TestEnv) => {
  let strategyInstance: CustomReserveInterestRateStrategy;
  let dai: MintableERC20;
  let aDai: AToken;
  let governance;

  before(async () => {
    dai = testEnv.dai;
    aDai = testEnv.aDai;

    const { addressesProvider } = testEnv;

    const signers = await getSigners();

    governance = signers[1];

    strategyInstance = await deployCustomReserveInterestRateStrategy(
      [
        addressesProvider.address,
        (3e26).toLocaleString('fullwide', { useGrouping: false }),
        (8e25).toLocaleString('fullwide', { useGrouping: false }),
        (1e26).toLocaleString('fullwide', { useGrouping: false }),
        (5e26).toLocaleString('fullwide', { useGrouping: false }),
        governance.address,
      ],
      false
    );
  });

  it('revert when non-governance address tries to change governance params', async () => {
    await expect(strategyInstance['setIntercept(uint256)'](13000)).to.be.revertedWith(
      'NotGovernance'
    );
    await expect(strategyInstance['setSlope(uint256)'](13000)).to.be.revertedWith('NotGovernance');
    await expect(
      strategyInstance['setWithdrawalShockProbability(uint256)'](13000)
    ).to.be.revertedWith('NotGovernance');
  });

  it('Checks rates at 0% utilization rate, empty reserve', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](dai.address, aDai.address, 0, 0, 0, 0, 0, strategyDAI.reserveFactor);

    // a = intercept
    // m = slope
    // q = probability of withdrawal shock
    // η = reserve factor
    // U⋆(θ; ρ) = utilizationRate
    // borrowing rate
    // E[ρ(θ)] = a + m · (1 + (η · q) / (1 - η)) · U⋆(θ; ρ)
    // liquidity rate
    // E[U(θ) · ρ(U(θ))] = U⋆(θ; ρ) · ((1 - q) · (a + m · U⋆(θ; ρ)) + q · (1 - η) · (a + m · (1 / (1 - η))))
    // here -
    // a = .1
    // m = .08
    // q = .3
    // n = .5

    const expectedBorrowingRate = new BigNumber(0.1).times(RAY);

    expect(currentLiquidityRate.toString()).to.be.equal('0', 'Invalid liquidity rate');
    expect(currentStableBorrowRate.toString()).to.be.equal(
      new BigNumber(0.039).times(RAY).toFixed(0),
      'Invalid stable rate'
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedBorrowingRate.toFixed(0),
      'Invalid variable rate'
    );
  });

  it('Checks rates at 80% utilization rate', async () => {
    const {
      0: currentLiquidityRate,
      1: currentStableBorrowRate,
      2: currentVariableBorrowRate,
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
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

    // a = intercept
    // m = slope
    // q = probability of withdrawal shock
    // η = reserve factor
    // U⋆(θ; ρ) = utilizationRate
    // borrowing rate
    // E[ρ(θ)] = a + m · (1 + (η · q) / (1 - η)) · U⋆(θ; ρ)
    // liquidity rate
    // E[U(θ) · ρ(U(θ))] = U⋆(θ; ρ) · ((1 - q) · (a + m · U⋆(θ; ρ)) + q · (1 - η) · (a + m · (1 / (1 - η))))
    // here -
    // a = .1
    // m = .08
    // q = .3
    // n = .5

    const utilizationRate = totalDebt.rayDiv(totalDebt.plus(availableLiquidity.toString()));

    const expectedVariableRate = new BigNumber(0.1)
      .times(RAY)
      .plus(
        new BigNumber(1.3).multipliedBy(new BigNumber(0.08)).times(RAY).rayMul(utilizationRate)
      );

    const expectedLiquidityRate = utilizationRate.rayMul(
      new BigNumber(0.7)
        .times(RAY)
        .rayMul(
          new BigNumber(0.1).times(RAY).plus(new BigNumber(0.08).times(RAY).rayMul(utilizationRate))
        )
        .plus(new BigNumber(0.15 * 0.26).times(RAY))
    );

    expect(currentVariableBorrowRate.toString()).to.be.equal(
      expectedVariableRate.toFixed(0),
      'Invalid variable rate'
    );

    expect(currentLiquidityRate.toString()).to.be.equal(
      expectedLiquidityRate.toFixed(0).toString(),
      'Invalid liquidity rate'
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
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
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

    // a = intercept
    // m = slope
    // q = probability of withdrawal shock
    // η = reserve factor
    // U⋆(θ; ρ) = utilizationRate
    // borrowing rate
    // E[ρ(θ)] = a + m · (1 + (η · q) / (1 - η)) · U⋆(θ; ρ)
    // liquidity rate
    // E[U(θ) · ρ(U(θ))] = U⋆(θ; ρ) · ((1 - q) · (a + m · U⋆(θ; ρ)) + q · (1 - η) · (a + m · (1 / (1 - η))))
    // here -
    // a = .1
    // m = .08
    // q = .3
    // n = .5

    const utilizationRate = totalDebt.rayDiv(totalDebt.plus(availableLiquidity.toString()));

    const expectedVariableRate = new BigNumber(0.1)
      .times(RAY)
      .plus(
        new BigNumber(1.3).multipliedBy(new BigNumber(0.08)).times(RAY).rayMul(utilizationRate)
      );

    const expectedLiquidityRate = utilizationRate.rayMul(
      new BigNumber(0.7)
        .times(RAY)
        .rayMul(
          new BigNumber(0.1).times(RAY).plus(new BigNumber(0.08).times(RAY).rayMul(utilizationRate))
        )
        .plus(new BigNumber(0.15 * 0.26).times(RAY))
    );

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
    } = await strategyInstance[
      'calculateInterestRates(address,address,uint256,uint256,uint256,uint256,uint256,uint256)'
    ](
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

    // a = intercept
    // m = slope
    // q = probability of withdrawal shock
    // η = reserve factor
    // U⋆(θ; ρ) = utilizationRate
    // borrowing rate
    // E[ρ(θ)] = a + m · (1 + (η · q) / (1 - η)) · U⋆(θ; ρ)
    // liquidity rate
    // E[U(θ) · ρ(U(θ))] = U⋆(θ; ρ) · ((1 - q) · (a + m · U⋆(θ; ρ)) + q · (1 - η) · (a + m · (1 / (1 - η))))
    // here -
    // a = .1
    // m = .08
    // q = .3
    // n = .5

    const expectedVariableRate = new BigNumber(0.1)
      .times(RAY)
      .plus(
        new BigNumber(1.3).multipliedBy(new BigNumber(0.08)).times(RAY).rayMul(utilizationRate)
      );

    const expectedLiquidityRate = utilizationRate.rayMul(
      new BigNumber(0.7)
        .times(RAY)
        .rayMul(
          new BigNumber(0.1).times(RAY).plus(new BigNumber(0.08).times(RAY).rayMul(utilizationRate))
        )
        .plus(new BigNumber(0.15 * 0.26).times(RAY))
    );

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

  it('should change params as governance', async () => {
    await strategyInstance.connect(governance).setIntercept(1300);
    await strategyInstance.connect(governance).setSlope(1300);
    await strategyInstance.connect(governance).setWithdrawalShockProbability(1300);

    expect(await strategyInstance['slope()']()).to.equal(1300);
    expect(await strategyInstance['intercept()']()).to.equal(1300);
    expect(await strategyInstance['withdrawalShockProbability()']()).to.equal(1300);
  });
});
