import BigNumber from 'bignumber.js';
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { RateMode } from '../../helpers/types';
import { makeSuite } from './helpers/make-suite';

const chai = require('chai');
const { expect } = chai;

makeSuite('Ithaca-protocol e2e test', (testEnv) => {
  it('Deposits IthacaCollateral, borrows USDC', async () => {
    const { weth, users, usdc, pool, oracle, ithacaFeed } = testEnv;

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

    const borrowerGlobalDataBefore = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataBefore.ltv).to.be.equal(10000);
    expect(borrowerGlobalDataBefore.totalCollateralETH).to.be.equal(amountETHtoDeposit);
    expect(borrowerGlobalDataBefore.availableBorrowsETH).to.be.equal(amountETHtoDeposit);
    expect(borrowerGlobalDataBefore.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(borrowerGlobalDataBefore.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const borrowerGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(borrowerGlobalDataAfter.ltv).to.be.equal(10000);
    expect(borrowerGlobalDataAfter.totalCollateralETH).to.be.equal(amountETHtoDeposit);
    expect(borrowerGlobalDataAfter.availableBorrowsETH).to.be.equal(
      borrowerGlobalDataBefore.availableBorrowsETH.sub(amountUSDCToBorrow.mul(usdcPrice).div(1e6))
    );
    expect(borrowerGlobalDataAfter.currentLiquidationThreshold).to.be.equal(10000);
    expect(borrowerGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });

  it('Deposits IthacaCollateral and USDC, borrows USDC', async () => {
    const { weth, users, usdc, pool, oracle, ithacaFeed } = testEnv;

    const depositor = users[0];
    const borrower = users[2];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //borrower deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

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

    await ithacaFeed.updateData(
      [
        {
          client: borrower.address,
          params: { maintenanceMargin: 0, mtm: 0, collateral: amountETHtoDeposit, valueAtRisk: 0 },
        },
      ],
      1
    );

    const borrowerGlobalDataBefore = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataBefore.ltv).to.be.equal(9000);
    expect(borrowerGlobalDataBefore.totalCollateralETH).to.be.equal((2e18).toFixed(0));
    expect(borrowerGlobalDataBefore.availableBorrowsETH).to.be.equal((1.8e18).toFixed(0));
    expect(borrowerGlobalDataBefore.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(borrowerGlobalDataBefore.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const borrowerGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(borrowerGlobalDataAfter.ltv).to.be.equal(9000);
    expect(borrowerGlobalDataAfter.totalCollateralETH).to.be.equal((2e18).toFixed());
    expect(borrowerGlobalDataAfter.availableBorrowsETH).to.be.equal(
      borrowerGlobalDataBefore.availableBorrowsETH.sub(amountUSDCToBorrow.mul(usdcPrice).div(1e6))
    );
    expect(borrowerGlobalDataAfter.currentLiquidationThreshold).to.be.equal(9125);
    expect(borrowerGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });

  it('Deposits IthacaCollateral and weth has positive mtm, borrows WETH', async () => {
    const { weth, users, usdc, pool, oracle, ithacaFeed } = testEnv;

    const depositor = users[0];
    const borrower = users[3];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //borrower deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints USDC to depositor
    await weth
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(weth.address, '1000'));

    //approve protocol to access depositor wallet
    await weth.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 1000 USDC
    const amountWETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(weth.address, amountWETHtoDeposit, depositor.address, '0');

    await ithacaFeed.updateData(
      [
        {
          client: borrower.address,
          params: {
            maintenanceMargin: 0,
            mtm: amountETHtoDeposit,
            collateral: amountETHtoDeposit,
            valueAtRisk: 0,
          },
        },
      ],
      1
    );

    const borrowerGlobalDataBefore = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataBefore.ltv).to.be.equal(9333);
    expect(borrowerGlobalDataBefore.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    expect(borrowerGlobalDataBefore.availableBorrowsETH).to.be.equal('2799900000000000000');
    expect(borrowerGlobalDataBefore.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const amountWETHtoBorrow = new BigNumber(
      borrowerGlobalDataBefore.availableBorrowsETH.toString()
    )
      .multipliedBy(0.8)
      .toFixed(0);

    await pool
      .connect(borrower.signer)
      .borrow(weth.address, amountWETHtoBorrow, RateMode.Variable, '0', borrower.address);

    const borrowerGlobalDataAfter = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataAfter.ltv).to.be.equal(9333);
    expect(borrowerGlobalDataAfter.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    expect(borrowerGlobalDataAfter.availableBorrowsETH).to.be.equal(
      borrowerGlobalDataBefore.availableBorrowsETH.sub(amountWETHtoBorrow)
    );
    expect(borrowerGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });

  it('Deposits WETH and USDC, borrows USDC', async () => {
    const { weth, users, usdc, pool, oracle, ithacaFeed } = testEnv;

    const depositor = users[0];
    const borrower = users[6];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //borrower deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints USDC to depositor
    await usdc.connect(borrower.signer).mint('271950383');

    //approve protocol to access depositor wallet
    await usdc.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 271.950383 USDC
    const amountUSDCtoDeposit = '271950383';
    await pool
      .connect(borrower.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, borrower.address, '0');

    //mints USDC to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //depositor deposits 1000 USDC
    const _amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, _amountUSDCtoDeposit, depositor.address, '0');

    const borrowerGlobalDataBefore = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataBefore.ltv).to.be.equal(8000);
    expect(borrowerGlobalDataBefore.totalCollateralETH).to.be.closeTo(
      (2e18).toFixed(0),
      (1e14).toFixed(0)
    );
    expect(borrowerGlobalDataBefore.availableBorrowsETH).to.be.closeTo(
      (1.6e18).toFixed(0),
      (1e14).toFixed(0)
    );
    expect(borrowerGlobalDataBefore.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(borrowerGlobalDataBefore.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const borrowerGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    expect(borrowerGlobalDataAfter.ltv).to.be.equal(8000);
    expect(borrowerGlobalDataAfter.totalCollateralETH).to.be.closeTo(
      (2e18).toFixed(0),
      (1e14).toFixed(0)
    );
    expect(borrowerGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });
});
