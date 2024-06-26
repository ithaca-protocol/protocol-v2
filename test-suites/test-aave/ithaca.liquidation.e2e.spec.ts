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
    let weth, users, pool, oracle, ithacaFeed: MockIthacaFeed, usdc, addressesProvider;
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
      ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
      await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
    });

    after('After LendingPool liquidation: reset config', () => {
      BigNumber.config({ DECIMAL_PLACES: 20, ROUNDING_MODE: BigNumber.ROUND_HALF_UP });
    });

    it('Deposits ithaca collateral', async () => {
      const { weth, users, pool } = testEnv;
      const borrower = users[1];

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: amountETHtoDeposit,
          valueAtRisk: 0,
        },
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
      const { weth, users, pool, usdc } = testEnv;
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
  const { INVALID_HF } = ProtocolErrors;

  describe('liquidate usdc borrowings', () => {
    let weth, users, pool, oracle, ithacaFeed: MockIthacaFeed, usdc, addressesProvider;
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
      ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
      await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
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
      const { usdc, weth, users, pool, oracle } = testEnv;
      const depositor = users[0];
      const borrower = users[1];

      const fundlock = users[4];

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

      //mints USDC to fundlock, a representation of 1eth locked in the fundlock by the borrower.
      await weth.connect(fundlock.signer).mint(await convertToCurrencyDecimals(weth.address, '2'));

      //approve protocol to access fundlock wallet
      await weth.connect(fundlock.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: amountETHtoDeposit,
          valueAtRisk: 0,
        },
        1
      );

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
      const { usdc, weth, users, pool, helpersContract } = testEnv;
      //   liquidator is fundlock
      const liquidator = users[4];
      const borrower = users[1];

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        usdc.address,
        borrower.address
      );

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
      const amountToLiquidate = userGlobalDataBefore.totalDebtETH;

      await increaseTime(100);

      await pool
        .connect(liquidator.signer)
        .liquidateIthacaCollateral(
          borrower.address,
          amountToLiquidate,
          weth.address,
          usdc.address,
          (2e18).toFixed(0),
          { gasLimit: '80000000' }
        );

      const userReserveDataAfter = await getUserData(
        pool,
        helpersContract,
        usdc.address,
        borrower.address
      );

      const fundlockBalAfter = await weth.balanceOf(liquidator.address);

      //   fundlockBalance deducted, will be equal to the collateral of the borrower, in current scenario.
      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: fundlockBalAfter,
          valueAtRisk: 0,
        },
        1,
        { gasLimit: '80000000' }
      );

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.totalDebtETH.toString()).to.be.bignumber.almostEqual(0);
      expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.eq(0);
    });
  });
});

makeSuite('', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  describe('liquidate weth borrowings', () => {
    let weth, users, pool, oracle, ithacaFeed: MockIthacaFeed, usdc, addressesProvider;
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
      ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
      await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
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
      const { usdc, weth, users, pool, oracle } = testEnv;
      const depositor = users[0];
      const borrower = users[1];

      const fundlock = users[4];

      //mints USDC to depositor
      await weth
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(weth.address, '1000'));

      //approve protocol to access depositor wallet
      await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //depositor deposits 1000 USDC
      const amountOfETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      await pool
        .connect(depositor.signer)
        .deposit(weth.address, amountOfETHtoDeposit, depositor.address, '0');

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      //mints weth to fundlock, a representation of 10usdc locked in the fundlock by the borrower.
      await usdc
        .connect(fundlock.signer)
        .mint(await convertToCurrencyDecimals(usdc.address, '1000000'));

      //approve protocol to access fundlock wallet
      await usdc.connect(fundlock.signer).approve(pool.address, (100e18).toFixed(0));

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: amountETHtoDeposit,
          valueAtRisk: 0,
        },
        1
      );

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
      const { usdc, users, pool, oracle } = testEnv;
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
      const { usdc, weth, users, pool, helpersContract } = testEnv;
      //   liquidator is fundlock
      const fundlock = users[4];
      const borrower = users[1];

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
      const amountToLiquidate = userGlobalDataBefore.totalDebtETH;

      await increaseTime(100);

      await pool
        .connect(fundlock.signer)
        .liquidateIthacaCollateral(
          borrower.address,
          amountToLiquidate,
          usdc.address,
          weth.address,
          (10e18).toFixed(0),
          { gasLimit: '80000000' }
        );

      const userReserveDataAfter = await getUserData(
        pool,
        helpersContract,
        weth.address,
        borrower.address
      );

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: 0,
          valueAtRisk: 0,
        },
        1
      );

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.almostEqual(
        0,
        'Invalid user debt after liquidation'
      );

      expect(userGlobalDataAfter.totalDebtETH.toString()).to.be.bignumber.almostEqual(0);
      expect(userReserveDataAfter.currentVariableDebt.toString()).to.be.bignumber.eq(0);
      expect(userGlobalDataAfter.availableBorrowsETH).to.be.eq(0);
    });
  });
});

makeSuite('', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  describe('reduce ithaca collateral and liquidate', () => {
    let weth, users, pool, oracle, ithacaFeed: MockIthacaFeed, usdc, addressesProvider;
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
      ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
      await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
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
      const { usdc, weth, users, pool, oracle } = testEnv;
      const depositor = users[0];
      const borrower = users[1];

      const fundlock = users[4];

      //mints USDC to depositor
      await weth
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(weth.address, '1000'));

      //approve protocol to access depositor wallet
      await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //depositor deposits 1000 USDC
      const amountOfETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      await pool
        .connect(depositor.signer)
        .deposit(weth.address, amountOfETHtoDeposit, depositor.address, '0');

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      //mints weth to fundlock, a representation of 10usdc locked in the fundlock by the borrower.
      await usdc
        .connect(fundlock.signer)
        .mint(await convertToCurrencyDecimals(usdc.address, '1000000'));

      //approve protocol to access fundlock wallet
      await usdc.connect(fundlock.signer).approve(pool.address, (100e18).toFixed(0));

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: amountETHtoDeposit,
          valueAtRisk: 0,
        },
        1
      );

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
      const { usdc, users, pool, oracle } = testEnv;
      const borrower = users[1];

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: 1e6,
          valueAtRisk: 0,
        },
        1
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
        oneEther.toFixed(0),
        INVALID_HF
      );
    });

    it('Liquidates the borrow', async () => {
      const { usdc, weth, users, pool, helpersContract } = testEnv;
      //   liquidator is fundlock
      const fundlock = users[4];
      const borrower = users[1];

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
      const amountToLiquidate = userGlobalDataBefore.totalDebtETH;

      await increaseTime(100);

      const fundlockBalBefore = await usdc.balanceOf(fundlock.address);

      await pool
        .connect(fundlock.signer)
        .liquidateIthacaCollateral(
          borrower.address,
          amountToLiquidate,
          usdc.address,
          weth.address,
          (1e6).toFixed(0),
          { gasLimit: '80000000' }
        );

      const fundlockBalAfter = await usdc.balanceOf(fundlock.address);

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(fundlockBalAfter).to.be.equal(fundlockBalBefore.sub(1e6));

      expect(userGlobalDataAfter.totalDebtETH.toString()).to.be.lt(
        userGlobalDataBefore.totalDebtETH
      );
      expect(userGlobalDataAfter.availableBorrowsETH).to.be.eq(0);
    });
  });
});

makeSuite('', (testEnv) => {
  const { INVALID_HF } = ProtocolErrors;

  describe('should not liquidate more than maxCollateralToLiquidate', () => {
    let weth, users, pool, oracle, ithacaFeed: MockIthacaFeed, usdc, addressesProvider;
    before('Before LendingPool liquidation: set config', async () => {
      BigNumber.config({ DECIMAL_PLACES: 0, ROUNDING_MODE: BigNumber.ROUND_DOWN });
      ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
      await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
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
      const { usdc, weth, users, pool, oracle } = testEnv;
      const depositor = users[0];
      const borrower = users[1];

      const fundlock = users[4];

      //mints USDC to depositor
      await weth
        .connect(depositor.signer)
        .mint(await convertToCurrencyDecimals(weth.address, '1000'));

      //approve protocol to access depositor wallet
      await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

      //depositor deposits 1000 USDC
      const amountOfETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      await pool
        .connect(depositor.signer)
        .deposit(weth.address, amountOfETHtoDeposit, depositor.address, '0');

      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      //mints weth to fundlock, a representation of 10usdc locked in the fundlock by the borrower.
      await usdc
        .connect(fundlock.signer)
        .mint(await convertToCurrencyDecimals(usdc.address, '1000000'));

      //approve protocol to access fundlock wallet
      await usdc.connect(fundlock.signer).approve(pool.address, (100e18).toFixed(0));

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: amountETHtoDeposit,
          valueAtRisk: 0,
        },
        1
      );

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
      const { usdc, users, pool, oracle } = testEnv;
      const borrower = users[1];

      await ithacaFeed.setData(
        {
          maintenanceMargin: 0,
          mtm: 0,
          collateral: 1e6,
          valueAtRisk: 0,
        },
        1
      );

      const userGlobalData = await pool.getUserAccountData(borrower.address);

      expect(userGlobalData.healthFactor.toString()).to.be.bignumber.lt(
        oneEther.toFixed(0),
        INVALID_HF
      );
    });

    it('Liquidates the borrow', async () => {
      const { usdc, weth, users, pool, helpersContract } = testEnv;
      //   liquidator is fundlock
      const fundlock = users[4];
      const borrower = users[1];

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);
      const amountToLiquidate = userGlobalDataBefore.totalDebtETH;

      await increaseTime(100);

      const fundlockBalBefore = await usdc.balanceOf(fundlock.address);

      await pool.connect(fundlock.signer).liquidateIthacaCollateral(
        borrower.address,
        amountToLiquidate,
        usdc.address,
        weth.address,
        (1e8).toFixed(0), // liquidate 1e18 at max
        { gasLimit: '80000000' }
      );

      const fundlockBalAfter = await usdc.balanceOf(fundlock.address);

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(fundlockBalAfter).to.be.equal(fundlockBalBefore.sub(1e8));

      // there should be some debt left, because of maxCollateralToLiquidate constraint.
      expect(userGlobalDataAfter.totalDebtETH).to.be.gt(0);
      expect(userGlobalDataAfter.availableBorrowsETH).to.be.eq(0);
    });
  });
});
