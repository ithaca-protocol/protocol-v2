import BigNumber from 'bignumber.js';
import { APPROVAL_AMOUNT_LENDING_POOL, MAX_UINT_AMOUNT } from '../../helpers/constants';
import { convertToCurrencyDecimals } from '../../helpers/contracts-helpers';
import { RateMode } from '../../helpers/types';
import { MockIthacaFeed } from '../../types';
import { makeSuite } from './helpers/make-suite';

const chai = require('chai');
const { expect } = chai;

makeSuite('Ithaca-protocol e2e test margin requirements', (testEnv) => {
  let weth, users, pool, oracle, ithacaFeed: MockIthacaFeed, usdc, addressesProvider;

  before('setup', async () => {
    ({ weth, users, usdc, pool, oracle, ithacaFeed, addressesProvider } = testEnv);
    await addressesProvider.setIthacaFeedOracle(ithacaFeed.address);
  });

  it('Deposits IthacaCollateral and weth has positive margin requirement, borrows USDC', async () => {
    const depositor = users[0];
    const borrower = users[4];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '1');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountDAItoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountDAItoDeposit, depositor.address, '0');

    let userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      {
        maintenanceMargin: (1e18).toFixed(0),
        mtm: 0,
        collateral: (1e18).toFixed(0),
        valueAtRisk: 0,
      },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(8000);
    expect(userGlobalData.totalCollateralETH).to.be.equal((1e18).toFixed(0));
    expect(userGlobalData.availableBorrowsETH).to.be.equal((0.8e18).toFixed(0));
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool
      .connect(borrower.signer)
      .getUserAccountData(borrower.address);

    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(8000);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal((1e18).toFixed(0));
    // expect(userGlobalDataAfter.availableBorrowsETH).to.be.equal(0);
    expect(userGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
    await resetIthacaFeed(borrower.address);
  });

  it('Deposits IthacaCollateral and 3 weth has negative margin requirement, borrows USDC', async () => {
    const depositor = users[0];
    const borrower = users[5];

    const amountETHtoDeposit = await convertToCurrencyDecimals(weth.address, '3');

    //mints WETH to borrower
    await weth.connect(borrower.signer).mint(amountETHtoDeposit);

    //approve protocol to access borrower wallet
    await weth.connect(borrower.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 2 deposits 1 WETH
    await pool
      .connect(borrower.signer)
      .deposit(weth.address, amountETHtoDeposit, borrower.address, '0');

    //mints DAI to depositor
    await usdc
      .connect(depositor.signer)
      .mint(await convertToCurrencyDecimals(usdc.address, '1000'));

    //approve protocol to access depositor wallet
    await usdc.connect(depositor.signer).approve(pool.address, APPROVAL_AMOUNT_LENDING_POOL);

    //user 1 deposits 1000 DAI
    const amountUSDCtoDeposit = await convertToCurrencyDecimals(usdc.address, '1000');
    await pool
      .connect(depositor.signer)
      .deposit(usdc.address, amountUSDCtoDeposit, depositor.address, '0');

    let userGlobalData = await pool.getUserAccountData(borrower.address);

    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    let isUsingIthacaAsCollateral = await pool.isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(false);

    await pool.connect(borrower.signer).setUsingIthacaCollateral(true);

    isUsingIthacaAsCollateral = await pool.connect(borrower.signer).isUsingIthacaCollateral();
    expect(isUsingIthacaAsCollateral).to.be.equal(true);

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    await ithacaFeed.setData(
      {
        maintenanceMargin: 0,
        mtm: -0x0de0b6b3a7640000n,
        collateral: 0,
        valueAtRisk: 0,
      },
      1
    );

    userGlobalData = await pool.connect(borrower.signer).getUserAccountData(borrower.address);

    // avg ltv
    expect(userGlobalData.ltv).to.be.equal(8000);
    expect(userGlobalData.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    expect(userGlobalData.availableBorrowsETH).to.be.equal((2.4e18).toFixed(0));
    expect(userGlobalData.healthFactor).to.be.equal(MAX_UINT_AMOUNT);

    const usdcPrice = await oracle.getAssetPrice(usdc.address);

    const amountUSDCToBorrow = await convertToCurrencyDecimals(
      usdc.address,
      new BigNumber(userGlobalData.availableBorrowsETH.toString())
        .multipliedBy(0.95)
        .div(usdcPrice.toString())
        .toFixed(0)
    );

    // 258000000 , 3677141364160000

    await pool
      .connect(borrower.signer)
      .borrow(usdc.address, amountUSDCToBorrow, RateMode.Variable, '0', borrower.address);

    const userGlobalDataAfter = await pool.getUserAccountData(borrower.address);

    // avg ltv
    expect(userGlobalDataAfter.ltv).to.be.equal(8000);
    expect(userGlobalDataAfter.totalCollateralETH).to.be.equal((3e18).toFixed(0));
    // expect(userGlobalDataAfter.availableBorrowsETH).to.be.equal(0);
    // expect(userGlobalDataAfter.currentLiquidationThreshold).to.be.equal(0);
    expect(userGlobalDataAfter.healthFactor).to.be.gt((1e18).toFixed(0));
  });

  async function resetIthacaFeed(client) {
    await ithacaFeed.setData(
      {
        maintenanceMargin: 0,
        mtm: 0,
        collateral: 0,
        valueAtRisk: 0,
      },
      1
    );
  }
});
