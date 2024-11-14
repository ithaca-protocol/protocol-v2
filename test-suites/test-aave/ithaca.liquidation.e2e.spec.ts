import BigNumber from 'bignumber.js';

import { parseEther } from 'ethers/lib/utils';
import { APPROVAL_AMOUNT_LENDING_POOL, oneEther } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { increaseTime } from '../../helpers/misc-utils';
import { ProtocolErrors, RateMode } from '../../helpers/types';
import { MockIthacaFeed } from '../../types';
import { makeSuite } from './helpers/make-suite';
import { getUserData } from './helpers/utils/helpers';

const chai = require('chai');
const { expect } = chai;
makeSuite('', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  describe('test calculateUserData for reserves', () => {
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    it('Deposits ithaca collateral', async () => {
      const { weth, users, pool, ithacaFeed } = testEnv;

      const borrower = users[1];

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      await ithacaFeed.updateData(
        [
          {
            client: borrower.address,
            params: {
              maintenanceMargin: 0,
              mtm: 0,
              collateral: amountETHtoDeposit,
              valueAtRisk: 0,
            },
          },
        ],
        1
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.totalCollateralETH).to.be.eq(
        amountETHtoDeposit,
        'should return ithaca collateral'
      );
    });

    it('Deposits usdc', async () => {
      const { weth, users, pool, usdc, oracle } = testEnv;
      const borrower = users[1];

      const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1');

      //mints USDC to user
      await usdc.connect(borrower.signer).mint(amountUSDCtoDeposit);

      //approve protocol to access borrower wallet
      await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      const usdcPrice = await oracle.getAssetPrice(usdc.address);

      const usdcDepositsInETH = usdcPrice.mul(amountUSDCtoDeposit).div(1e6);

      await pool
        .connect(borrower.signer)
        .deposit(usdc.address, amountUSDCtoDeposit, borrower.address, '0');

      const depositedIthacaCollateral = await convertToCurrencyDecimals(weth.address, '1');

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.totalCollateralETH).to.be.eq(
        depositedIthacaCollateral.add(usdcDepositsInETH),
        'should return ithaca collateral + usdc deposits'
      );
    });

    it('Deposits weth', async () => {
      const { weth, users, pool, usdc, oracle } = testEnv;

      const borrower = users[1];

      const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1');

      const usdcPrice = await oracle.getAssetPrice(usdc.address);

      const usdcDepositsInETH = usdcPrice.mul(amountUSDCtoDeposit).div(1e6);

      const amountWETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      //mints weth to user
      await weth.connect(borrower.signer).mint(amountWETHtoDeposit);

      //approve protocol to access borrower wallet
      await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      await pool
        .connect(borrower.signer)
        .deposit(weth.address, amountWETHtoDeposit, borrower.address, '0');

      const depositedIthacaCollateral = await convertToCurrencyDecimals(weth.address, '1');

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.totalCollateralETH).to.be.eq(
        depositedIthacaCollateral.add(usdcDepositsInETH).add(amountWETHtoDeposit),
        'should return ithaca collateral + usdc deposits + weth deposits'
      );
    });
  });
});

makeSuite('', (testEnv) => {
  describe('only lending pool can call ithacaLiquidationCall()', () => {
    it("It's not possible to liquidate on a non-active collateral or a non active principal", async () => {
      const { weth, pool, users, usdc } = testEnv;

      const liquidator = users[4];
      const borrower = users[3];

      await expect(
        pool
          .connect(liquidator.signer)
          .ithacaLiquidationCall(
            weth.address,
            usdc.address,
            borrower.address,
            (2e18).toFixed(0),
            liquidator.address
          )
      ).to.be.revertedWith('81');
    });
  });
});

makeSuite('', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  describe('liquidate usdc borrowings', () => {
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    it("It's not possible to liquidate on a non-active collateral or a non active principal", async () => {
      const { configurator, weth, pool, users, usdc } = testEnv;

      const user = users[1];
      await configurator.deactivateReserve(weth.address);

      await expect(
        pool.liquidationCall(weth.address, usdc.address, user.address, parseEther('1000'), false)
      ).to.be.revertedWith('2');

      await configurator.activateReserve(weth.address);

      await configurator.deactivateReserve(usdc.address);

      await expect(
        pool.liquidationCall(weth.address, usdc.address, user.address, parseEther('1000'), false)
      ).to.be.revertedWith('2');

      await configurator.activateReserve(usdc.address);
    });

    it('Deposits ithaca collateral, borrows usdc', async () => {
      const { usdc, weth, users, pool, oracle, fundlock } = testEnv;

      const depositor = users[0];
      const borrower = users[1];

      //mints USDC to depositor
      await usdc
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

      //approve protocol to access depositor wallet
      await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //depositor deposits 1000 USDC
      const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');

      await pool
        .connect(depositor.signer)
        .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      //mints WETH to borrower
      await weth.connect(borrower.signer).mint(amountETHtoDeposit);

      //approve fundlock to access borrower wallet
      await weth.connect(borrower.signer).approve(fundlock.address, APPROVAL_AMOUNT_LENDING_POOL);

      //borrower deposits 1000 USDC
      await fundlock
        .connect(borrower.signer)
        .deposit(borrower.address, weth.address, amountETHtoDeposit);

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      const usdcPrice = await oracle.getAssetPrice(usdc.address);
      const amountUSDCToBorrow = await convertToCurrencyDecimals(
        usdc.address,
        new BigNumber(userGlobalData.availableBorrowsETH.toString())
          .div(usdcPrice.toString())
          .multipliedBy(0.9502)
          .toFixed(0)
      );

      await pool
        .connect(borrower.signer)
        .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
        '10000',
        INVALID_HF
      );
    });

    it('Drop the health factor below 1', async () => {
      const { usdc, users, pool, oracle } = testEnv;

      const borrower = users[1];

      const usdcPrice = await oracle.getAssetPrice(usdc.address);

      await oracle.setAssetPrice(
        usdc.address,
        new BigNumber(usdcPrice.toString()).multipliedBy(1.18).toFixed(0)
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
        oneEther.toFixed(0),
        INVALID_HF
      );
    });

    it('Liquidates the borrow', async () => {
      const { usdc, weth, users, pool, helpersContract, fundlock } = testEnv;

      const borrower = users[1];
      const liquidator = users[4];

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        usdc.address,
        borrower.address
      );
      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);

      const amountToLiquidate = userGlobalDataBefore.totalDebtETH;

      //mints USDC to liquidator
      await usdc.connect(liquidator.signer).mint(amountToLiquidate);

      //approve fundlock to access liquidator wallet
      await usdc.connect(liquidator.signer).approve(fundlock.address, APPROVAL_AMOUNT_LENDING_POOL);

      //deposit to fundlock
      await fundlock
        .connect(liquidator.signer)
        .deposit(liquidator.address, usdc.address, amountToLiquidate);

      await increaseTime(100);

      await fundlock
        .connect(liquidator.signer)
        .liquidationCall(
          weth.address,
          usdc.address,
          borrower.address,
          amountToLiquidate,
          liquidator.address
        );

      const userReserveDataAfter = await getUserData(
        pool,
        helpersContract,
        usdc.address,
        borrower.address
      );
      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.totalDebtETH.toString()).to.be.bignumber.lt(
        userGlobalDataBefore.totalDebtETH.toString()
      );
      expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.lt(
        userReserveDataBefore.currentVariableDebt.toString()
      );
    });
  });
});

makeSuite('', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  describe('liquidate weth borrowings', () => {
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    it("It's not possible to liquidate on a non-active collateral or a non active principal", async () => {
      const { configurator, weth, pool, users, usdc } = testEnv;

      const user = users[1];
      await configurator.deactivateReserve(usdc.address);

      await expect(
        pool.liquidationCall(weth.address, usdc.address, user.address, parseEther('1000'), false)
      ).to.be.revertedWith('2');

      await configurator.activateReserve(usdc.address);

      await configurator.deactivateReserve(weth.address);

      await expect(
        pool.liquidationCall(weth.address, usdc.address, user.address, parseEther('1000'), false)
      ).to.be.revertedWith('2');

      await configurator.activateReserve(weth.address);
    });

    it('Deposits ithaca collateral, borrows weth', async () => {
      const { usdc, weth, users, pool, fundlock } = testEnv;

      const depositor = users[0];
      const borrower = users[1];

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      //mints WETH to depositor
      await weth.connect(depositor.signer).mint(amountETHtoDeposit);

      //approve protocol to access depositor wallet
      await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //depositor deposits 2 WETH
      await pool
        .connect(depositor.signer)
        .deposit(weth.address, amountETHtoDeposit, depositor.address, '0');

      const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '10');
      //mints USDC to borrower
      await usdc.connect(borrower.signer).mint(amountUSDCtoDeposit);

      //approve fundlock to access borrower wallet
      await usdc.connect(borrower.signer).approve(fundlock.address, APPROVAL_AMOUNT_LENDING_POOL);

      //deposit to fundlock
      await fundlock
        .connect(borrower.signer)
        .deposit(borrower.address, usdc.address, amountUSDCtoDeposit);

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      const amountWETHtoBorrow = new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.8)
        .toFixed(0);

      await pool
        .connect(borrower.signer)
        .borrow(weth.address, amountWETHtoBorrow, RateMode.Variable, '0', borrower.address);

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.currentLiquidationThreshold.toString()).to.be.bignumber.equal(
        '10000',
        INVALID_HF
      );
    });

    it('Drop the health factor below 1', async () => {
      const { weth, users, pool, oracle } = testEnv;

      const borrower = users[1];

      const wethPrice = await oracle.getAssetPrice(weth.address);

      await oracle.setAssetPrice(
        weth.address,
        new BigNumber(wethPrice.toString()).multipliedBy(1.25).toFixed(0)
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
        oneEther.toFixed(0),
        INVALID_HF
      );
    });

    it('Liquidates the borrow', async () => {
      const { usdc, weth, users, pool, helpersContract, fundlock } = testEnv;

      const borrower = users[1];
      const liquidator = users[4];

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        weth.address,
        borrower.address
      );
      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);

      const amountToLiquidate = userGlobalDataBefore.totalDebtETH;
      //mints WETH to liquidator
      await weth.connect(liquidator.signer).mint(amountToLiquidate);

      //approve fundlock to access liquidator wallet
      await weth.connect(liquidator.signer).approve(fundlock.address, APPROVAL_AMOUNT_LENDING_POOL);

      //deposit to fundlock
      await fundlock
        .connect(liquidator.signer)
        .deposit(liquidator.address, weth.address, amountToLiquidate);

      await increaseTime(100);

      await fundlock
        .connect(liquidator.signer)
        .liquidationCall(
          usdc.address,
          weth.address,
          borrower.address,
          amountToLiquidate,
          liquidator.address
        );

      const userReserveDataAfter = await getUserData(
        pool,
        helpersContract,
        weth.address,
        borrower.address
      );
      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.totalDebtETH.toString()).to.be.bignumber.lt(
        userGlobalDataBefore.totalDebtETH.toString()
      );
      expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.lt(
        userReserveDataBefore.currentVariableDebt.toString()
      );
    });
  });
});
