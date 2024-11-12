import BigNumber from 'bignumber.js';
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { RateMode } from '../../helpers/types';
import { makeSuite } from './helpers/make-suite';

const chai = require('chai');
const { expect } = chai;

makeSuite('Ithaca-protocol e2e test margin requirements', (testEnv) => {
  it('Deposits IthacaCollateral and weth has positive margin requirement, borrows USDC', async () => {
    const { weth, users, usdc, pool, oracle, ithacaFeed } = testEnv;

    const depositor = users[0];
    const borrower = users[4];

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
          params: { maintenanceMargin: 0, mtm: 0, collateral: (1e18).toFixed(0), valueAtRisk: 0 },
        },
      ],
      1
    );

    const borrowerGlobalDataBefore = await pool.getUserAccountData(borrower.address);

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

    const borrowerGlobalDataAfter = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataAfter.ltv).to.be.equal(9000);
    expect(borrowerGlobalDataAfter.totalCollateralETH).to.be.equal((2e18).toFixed(0));
    expect(borrowerGlobalDataAfter.availableBorrowsETH).to.be.equal(
      new BigNumber(1.8e18).minus(amountUSDCToBorrow.mul(usdcPrice).div(1e6).toString()).toFixed()
    );
    expect(borrowerGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });

  it('Deposits IthacaCollateral and 3 weth has negative margin requirement, borrows USDC', async () => {
    const { weth, users, usdc, pool, oracle, ithacaFeed } = testEnv;

    const depositor = users[0];
    const borrower = users[5];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '3');

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
          params: {
            maintenanceMargin: 0,
            mtm: (-1e18).toFixed(0),
            collateral: 0,
            valueAtRisk: 0,
          },
        },
      ],
      1
    );

    const borrowerGlobalDataBefore = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    expect(borrowerGlobalDataBefore.ltv).to.be.equal(8000);
    expect(borrowerGlobalDataBefore.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    expect(borrowerGlobalDataBefore.availableBorrowsETH).to.be.equal((2.4e18).toFixed(0));
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
    expect(borrowerGlobalDataAfter.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    expect(borrowerGlobalDataAfter.availableBorrowsETH).to.be.equal(
      borrowerGlobalDataBefore.availableBorrowsETH.sub(amountUSDCToBorrow.mul(usdcPrice).div(1e6))
    );
    expect(borrowerGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });
});
