import { task, types } from 'hardhat/config';
import {
  getIthacaFeed,
  getLendingPool,
  getLendingPoolAddressesProvider,
  getLendingPoolConfiguratorProxy,
  getMintableERC20FromDB,
  getPriceOracle,
} from '../../helpers/contracts-getters';
import { getEthersSigners } from '../../helpers/contracts-helpers';
import { RateMode } from '../../helpers/types';
import { ContractTransaction } from 'ethers';

async function waitTx(tx: Promise<ContractTransaction>) {
  const receipt = await (await tx).wait();
  return receipt.transactionHash;
}

async function getEnv() {
  let users = await getEthersSigners();
  let pool = await getLendingPool();
  let oracle = await getPriceOracle();
  let ithacaFeed = await getIthacaFeed();
  let usdc = await getMintableERC20FromDB('USDC');
  let weth = await getMintableERC20FromDB('WETH');
  let addressesProvider = await getLendingPoolAddressesProvider();
  let configurator = await getLendingPoolConfiguratorProxy();

  return { users, pool, oracle, ithacaFeed, usdc, weth, addressesProvider, configurator };
}

task('deposit', 'deposits token to pool')
  .addParam('token', 'token symbol')
  .addParam('amount', 'amount to deposit in token decimals')
  .addParam('signerid', 'signer index')
  .setAction(async ({ token, amount, signerid }, localBRE) => {
    await localBRE.run('set-DRE');
    const { pool, users } = await getEnv();

    let tokenContract = await getMintableERC20FromDB(token);

    const signer = users[signerid];

    tokenContract.connect(signer);
    await tokenContract.approve(pool.address, amount);
    pool.connect(signer);
    const hash = await waitTx(pool.deposit(tokenContract.address, amount, signer.address, '0'));

    console.log(`deposited ${amount} ${token} tokens by ${signer.address}`);
    console.log(`transaction-id - ${hash}`);
  });

task('withdraw', 'withdraw token from the pool')
  .addParam('token', 'token symbol')
  .addParam('amount', 'amount to deposit in token decimals')
  .addParam('signerid', 'signer index')
  .addOptionalParam('to', 'transfer tokens to')
  .setAction(async ({ token, amount, signerid, to }, localBRE) => {
    await localBRE.run('set-DRE');
    const { pool, users } = await getEnv();

    let tokenContract = await getMintableERC20FromDB(token);

    const signer = users[signerid];

    tokenContract.connect(signer);
    await tokenContract.approve(pool.address, amount);
    pool.connect(signer);
    const hash = await waitTx(pool.withdraw(tokenContract.address, amount, to || signer.address));

    console.log(`withdrawn ${amount} ${token} tokens by ${signer.address}`);
    console.log(`transaction-id - ${hash}`);
  });

task('mint', 'mint tokens to the user')
  .addParam('token', 'token symbol')
  .addParam('amount', 'amount to deposit in token decimals')
  .addParam('signerid', 'signer index')
  .setAction(async ({ token, amount, signerid }, localBRE) => {
    await localBRE.run('set-DRE');
    const { pool, users } = await getEnv();

    let tokenContract = await getMintableERC20FromDB(token);

    console.log(signerid);
    const signer = users[signerid];

    tokenContract.connect(signer);
    const hash = await waitTx(tokenContract.mint(amount));

    console.log(`Minted ${amount} ${token} tokens to ${signer.address}`);
    console.log(`transaction-id - ${hash}`);
  });

task('borrow', 'borrow tokens from pool')
  .addParam('token', 'token symbol')
  .addParam('amount', 'amount to deposit in token decimals')
  .addParam('signerid', 'signer index')
  .addOptionalParam('variableMode', 'toggle between variable and stable mode', true, types.boolean)
  .setAction(async ({ token, amount, signerid, variableMode }, localBRE) => {
    await localBRE.run('set-DRE');
    const { pool, users } = await getEnv();

    let tokenContract = await getMintableERC20FromDB(token);

    const borrower = users[signerid];

    pool.connect(borrower.signer);
    const hash = await waitTx(
      pool.borrow(
        tokenContract.address,
        amount,
        variableMode ? RateMode.Variable : RateMode.Stable,
        '0',
        borrower.address
      )
    );

    console.log(`borrowed ${amount} ${token} tokens by ${borrower.address}`);
    console.log(`transaction-id - ${hash}`);
  });

task('amount-to-liquidate', 'get amount to liquidate')
  .addParam('borrower', 'address of the borrower')
  .setAction(async ({ borrower }, localBRE) => {
    await localBRE.run('set-DRE');

    const { pool } = await getEnv();

    const userGlobalDataBefore = await pool.getUserAccountData(borrower);

    const amountToLiquidate = userGlobalDataBefore.totalDebtETH;

    console.log(`amountToLiquidate - ${amountToLiquidate}`);
  });

task('liquidate', 'liquidate borrows')
  .addParam('borrower', 'address of the borrower')
  .addParam('amount', 'amount to liquidate')
  .addParam('collateral', 'amount to liquidate')
  .addParam('principal', 'debt asset')
  .addParam('atoken', 'receive A-token', false, types.boolean)
  .addParam('signerid', 'index of signer')
  .setAction(async ({ borrower, amount, collateral, principal, atoken, signerid }, localBRE) => {
    await localBRE.run('set-DRE');

    const { pool, users } = await getEnv();

    const liquidator = users[signerid];

    let principalContract = await getMintableERC20FromDB(principal);
    let collateralContract = await getMintableERC20FromDB(collateral);

    console.log(principalContract.address, collateralContract.address, pool.address);

    pool.connect(liquidator.signer);
    console.log(
      'here!',
      collateralContract.address,
      principalContract.address,
      borrower,
      amount,
      atoken
    );
    const hash = await waitTx(
      pool.liquidationCall(
        collateralContract.address,
        principalContract.address,
        borrower,
        amount,
        atoken
      )
    );

    console.log(`liquidated - ${amount}`);
    console.log(`transaction-id - ${hash}`);
  });
