import BigNumber from 'bignumber.js';

import { parseEther } from 'ethers/lib/utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { DRE, increaseTime } from '../../helpers/misc-utils';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { makeSuite } from './helpers/make-suite';
import {
  calcExpectedStableDebtTokenBalance,
  calcExpectedVariableDebtTokenBalance,
} from './helpers/utils/calculations';
import { getReserveData, getUserData } from './helpers/utils/helpers';

const chai = require('chai');
const { expect } = chai;

makeSuite('LendingPool liquidation - liquidator receiving aToken', (testEnv) => {
  const {
    LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD,
    INVALID_HF,
    LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER,
    LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED,
    LP_IS_PAUSED,
  } = ProtocolErrors;

  describe('Underlying asset', () => {
    before('Before LendingPool liquidation: set config', () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    it("It's not possible to liquidate on a non-active collateral or a non active principal", async () => {
      const { configurator, weth, pool, users, dai } = testEnv;
      const user = users[1];
      await configurator.deactivateReserve(weth.address);

      await expect(
        pool.liquidationCall(weth.address, dai.address, user.address, parseEther('1000'), false)
      ).to.be.revertedWith('2');

      await configurator.activateReserve(weth.address);

      await configurator.deactivateReserve(dai.address);

      await expect(
        pool.liquidationCall(weth.address, dai.address, user.address, parseEther('1000'), false)
      ).to.be.revertedWith('2');

      await configurator.activateReserve(dai.address);
    });

    it('Deposits WETH, borrows DAI', async () => {
      const { dai, weth, users, pool, oracle } = testEnv;
      const depositor = users[0];
      const borrower = users[1];

      //mints DAI to depositor
      await dai
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(dai.address, '1000'));

      //approve protocol to access depositor wallet
      await dai.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //user 1 deposits 1000 DAI
      const amountDAItoDeposit = await convertToCurrencyDecimals(dai.address, '1000');

      await pool
        .connect(depositor.signer)
        .deposit(dai.address, amountDAItoDeposit, depositor.address, '0');
      //user 2 deposits 1 ETH
      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      //mints WETH to borrower
      await weth
        .connect(borrower.signer)
        .mint(await convertToCurrencyDecimals(weth.address, '1000'));

      //approve protocol to access the borrower wallet
      await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      await pool
        .connect(borrower.signer)
        .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

      //user 2 borrows

      const userGlobalData = await pool.getUserAccountData(borrower.address);
      const daiPrice = await oracle.getAssetPrice(dai.address);

      const amountDAIToBorrow = await convertToCurrencyDecimals(
        dai.address,
        new BigNumber(userGlobalData.availableBorrowsETH.toString())
          .div(daiPrice.toString())
          .multipliedBy(0.95)
          .toFixed(0)
      );

      await pool
        .connect(borrower.signer)
        .borrow(dai.address, amountDAIToBorrow, RateMode.Stable, '0', borrower.address);

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
        '8250',
        INVALID_HF
      );
    });

    it('Drop the health factor below 1', async () => {
      const { dai, weth, users, pool, oracle } = testEnv;
      const borrower = users[1];

      const daiPrice = await oracle.getAssetPrice(dai.address);

      await oracle.setAssetPrice(
        dai.address,
        new BigNumber(daiPrice.toString()).multipliedBy(1.18).toFixed(0)
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
        oneEther.toFixed(0),
        INVALID_HF
      );
    });

    it('Liquidates the borrow', async () => {
      const { dai, weth, users, pool, oracle, helpersContract } = testEnv;
      const liquidator = users[3];
      const borrower = users[1];

      //mints dai to the liquidator
      await dai
        .connect(liquidator.signer)
        .mint(await convertToCurrencyDecimals(dai.address, '1000'));

      //approve protocol to access the liquidator wallet
      await dai.connect(liquidator.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      const daiReserveDataBefore = await helpersContract.getReserveData(dai.address);
      const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        dai.address,
        borrower.address
      );

      const amountToLiquidate = userReserveDataBefore.currentStableDebt.div(2).toFixed(0);

      await increaseTime(100);

      const tx = await pool
        .connect(liquidator.signer)
        .liquidationCall(weth.address, dai.address, borrower.address, amountToLiquidate, false);

      const userReserveDataAfter = await getUserData(
        pool,
        helpersContract,
        dai.address,
        borrower.address
      );

      const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
      const ethReserveDataAfter = await helpersContract.getReserveData(weth.address);

      const collateralPrice = await oracle.getAssetPrice(weth.address);
      const principalPrice = await oracle.getAssetPrice(dai.address);

      const collateralDecimals = (
        await helpersContract.getReserveConfigurationData(weth.address)
      ).decimals.toString();
      const principalDecimals = (
        await helpersContract.getReserveConfigurationData(dai.address)
      ).decimals.toString();

      const expectedCollateralLiquidated = new BigNumber(principalPrice.toString())
        .times(new BigNumber(amountToLiquidate).times(105))
        .times(new BigNumber(10).pow(collateralDecimals))
        .div(
          new BigNumber(collateralPrice.toString()).times(new BigNumber(10).pow(principalDecimals))
        )
        .div(100)
        .decimalPlaces(0, BigNumber.ROUND_DOWN);

      if (!tx.blockNumber) {
        expect(false, 'Invalid block number');
        return;
      }
      const txTimestamp = new BigNumber(
        (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
      );

      const stableDebtBeforeTx = calcExpectedStableDebtTokenBalance(
        userReserveDataBefore.principalStableDebt,
        userReserveDataBefore.stableBorrowRate,
        userReserveDataBefore.stableRateLastUpdated,
        txTimestamp
      );

      expect(userReserveDataAfter.currentStableDebt.toString()).to.be.bignumber.almostEqual(
        stableDebtBeforeTx.minus(amountToLiquidate).toFixed(0),
        'Invalid user debt after liquidation'
      );

      //the liquidity index of the principal reserve needs to be bigger than the index before
      expect(daiReserveDataAfter.liquidityIndex.toString()).to.be.bignumber.gte(
        daiReserveDataBefore.liquidityIndex.toString(),
        'Invalid liquidity index'
      );

      //the principal APY after a liquidation needs to be lower than the APY before
      expect(daiReserveDataAfter.liquidityRate.toString()).to.be.bignumber.lt(
        daiReserveDataBefore.liquidityRate.toString(),
        'Invalid liquidity APY'
      );

      expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
        new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
          .plus(amountToLiquidate)
          .toFixed(0),
        'Invalid principal available liquidity'
      );

      expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
        new BigNumber(ethReserveDataBefore.availableLiquidity.toString())
          .minus(expectedCollateralLiquidated)
          .toFixed(0),
        'Invalid collateral available liquidity'
      );
    });
  });
});
