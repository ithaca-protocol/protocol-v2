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

  describe('AToken', () => {
    it('Deposits WETH, borrows DAI/Check liquidation fails because health factor is above 1', async () => {
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

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      //mints WETH to borrower
      await weth.connect(borrower.signer).mint(amountETHtoDeposit);

      //approve protocol to access borrower wallet
      await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //user 2 deposits 1 WETH
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
        .borrow(dai.address, amountDAIToBorrow, RateMode.Variable, '0', borrower.address);

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
        '8250',
        'Invalid liquidation threshold'
      );

      //someone tries to liquidate user 2
      await expect(
        pool.liquidationCall(weth.address, dai.address, borrower.address, 1, true)
      ).to.be.revertedWith(LPCM_HEALTH_FACTOR_NOT_BELOW_THRESHOLD);

      expect(await pool.isUsingIthacaCollateral()).to.be.equal(false);
    });

    it('Drop the health factor below 1', async () => {
      const { dai, users, pool, oracle } = testEnv;
      const borrower = users[1];

      const daiPrice = await oracle.getAssetPrice(dai.address);

      await oracle.setAssetPrice(
        dai.address,
        new BigNumber(daiPrice.toString()).multipliedBy(1.15).toFixed(0)
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
        oneEther.toString(),
        INVALID_HF
      );
    });

    it('Tries to liquidate a different currency than the loan principal', async () => {
      const { pool, users, weth } = testEnv;
      const borrower = users[1];
      //user 2 tries to borrow
      await expect(
        pool.liquidationCall(
          weth.address,
          weth.address,
          borrower.address,
          oneEther.toString(),
          true
        )
      ).revertedWith(LPCM_SPECIFIED_CURRENCY_NOT_BORROWED_BY_USER);
    });

    it('Tries to liquidate a different collateral than the borrower collateral', async () => {
      const { pool, dai, users } = testEnv;
      const borrower = users[1];

      await expect(
        pool.liquidationCall(dai.address, dai.address, borrower.address, oneEther.toString(), true)
      ).revertedWith(LPCM_COLLATERAL_CANNOT_BE_LIQUIDATED);
    });

    it('Liquidates the borrow', async () => {
      const { pool, dai, weth, aWETH, aDai, users, oracle, helpersContract, deployer } = testEnv;
      const borrower = users[1];

      //mints dai to the caller

      await dai.mint(await convertToCurrencyDecimals(dai.address, '1000'));

      //approve protocol to access depositor wallet
      await dai.approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      const daiReserveDataBefore = await getReserveData(helpersContract, dai.address);
      const ethReserveDataBefore = await helpersContract.getReserveData(weth.address);

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        dai.address,
        borrower.address
      );

      const amountToLiquidate = new BigNumber(userReserveDataBefore.currentVariableDebt.toString())
        .div(2)
        .toFixed(0);

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
      const tx = await pool.liquidationCall(
        weth.address,
        dai.address,
        borrower.address,
        amountToLiquidate,
        true
      );

      const userReserveDataAfter = await helpersContract.getUserReserveData(
        dai.address,
        borrower.address
      );

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      const daiReserveDataAfter = await helpersContract.getReserveData(dai.address);
      const ethReserveDataAfter = await helpersContract.getReserveData(weth.address);

      const collateralPrice = (await oracle.getAssetPrice(weth.address)).toString();
      const principalPrice = (await oracle.getAssetPrice(dai.address)).toString();

      const collateralDecimals = (
        await helpersContract.getReserveConfigurationData(weth.address)
      ).decimals.toString();
      const principalDecimals = (
        await helpersContract.getReserveConfigurationData(dai.address)
      ).decimals.toString();

      const expectedCollateralLiquidated = new BigNumber(principalPrice)
        .times(new BigNumber(amountToLiquidate).times(105))
        .times(new BigNumber(10).pow(collateralDecimals))
        .div(new BigNumber(collateralPrice).times(new BigNumber(10).pow(principalDecimals)))
        .decimalPlaces(0, BigNumber.ROUND_DOWN);

      if (!tx.blockNumber) {
        expect(false, 'Invalid block number');
        return;
      }

      expect(await pool.isUsingIthacaCollateral()).to.be.equal(false);

      const txTimestamp = new BigNumber(
        (await DRE.ethers.provider.getBlock(tx.blockNumber)).timestamp
      );

      const variableDebtBeforeTx = calcExpectedVariableDebtTokenBalance(
        daiReserveDataBefore,
        userReserveDataBefore,
        txTimestamp
      );

      expect(userGlobalDataAfter.healthFactor.toString()).to.be.bignumber.gt(
        userGlobalDataBefore.healthFactor.toString(),
        'Invalid health factor'
      );

      expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
        new BigNumber(variableDebtBeforeTx).minus(amountToLiquidate).toFixed(0),
        'Invalid user borrow balance after liquidation'
      );

      expect(daiReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
        new BigNumber(daiReserveDataBefore.availableLiquidity.toString())
          .plus(amountToLiquidate)
          .toFixed(0),
        'Invalid principal available liquidity'
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

      expect(ethReserveDataAfter.availableLiquidity.toString()).to.be.bignumber.almostEqual(
        new BigNumber(ethReserveDataBefore.availableLiquidity.toString()).toFixed(0),
        'Invalid collateral available liquidity'
      );

      expect(
        (await helpersContract.getUserReserveData(weth.address, deployer.address))
          .usageAsCollateralEnabled
      ).to.be.true;
    });
  });
});
