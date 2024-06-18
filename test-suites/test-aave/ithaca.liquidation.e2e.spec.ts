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

      await pool.connect(borrower.signer).setUsingIthacaCollateral(true);
      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

      //mints USDC to fundlock, a representation of 1eth locked in the fundlock by the borrower.
      await weth.connect(fundlock.signer).mint(amountETHtoDeposit);

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
      const receiver = users[5];

      await addressesProvider.setReceiverAccount(receiver.address);

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        usdc.address,
        borrower.address
      );

      const amountToLiquidate = userReserveDataBefore.currentVariableDebt.toFixed(0);

      await increaseTime(100);

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);

      await pool
        .connect(liquidator.signer)
        .liquidateIthacaCollateral(
          borrower.address,
          amountToLiquidate,
          weth.address,
          usdc.address,
          (1e18).toFixed(0)
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
        1
      );

      const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

      expect(userGlobalDataAfter.totalDebtETH).to.be.lt(userGlobalDataBefore.totalDebtETH);
      //   debt not fully covered, but collateral is 0
      expect(userGlobalDataAfter.healthFactor).to.be.eq(0);
      expect(userGlobalDataAfter.availableBorrowsETH).to.be.eq(0);
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

      await pool.connect(borrower.signer).setUsingIthacaCollateral(true);
      const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '2');

      //mints USDC to fundlock, a representation of 1eth locked in the fundlock by the borrower.
      await usdc.connect(fundlock.signer).mint(await convertToCurrencyDecimals(weth.address, '10'));

      //approve protocol to access fundlock wallet
      await usdc.connect(fundlock.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

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
      const liquidator = users[4];
      const borrower = users[1];
      const receiver = users[5];

      await addressesProvider.setReceiverAccount(receiver.address);

      const userReserveDataBefore = await getUserData(
        pool,
        helpersContract,
        weth.address,
        borrower.address
      );

      const amountToLiquidate = userReserveDataBefore.currentVariableDebt.toFixed(0);

      await increaseTime(100);

      const userGlobalDataBefore = await pool.getUserAccountData(borrower.address);

      await pool
        .connect(liquidator.signer)
        .liquidateIthacaCollateral(
          borrower.address,
          amountToLiquidate,
          usdc.address,
          weth.address,
          (10e18).toFixed(0)
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

      expect(userGlobalDataAfter.totalDebtETH).to.be.lt(userGlobalDataBefore.totalDebtETH);
      console.log(userGlobalDataAfter);
      //   debt not fully covered, but collateral is 0
      expect(userGlobalDataAfter.healthFactor).to.be.eq(0);
      expect(userGlobalDataAfter.availableBorrowsETH).to.be.eq(0);
    });
  });
});
