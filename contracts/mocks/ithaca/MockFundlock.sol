// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

import {IFundlock} from '../../interfaces/ithaca/IFundlock.sol';
import {ILendingPool} from '../../interfaces/ILendingPool.sol';

/**
 * @title Fundlock
 * @notice Fundlock is a smart contract managing client deposits.
 */
contract MockFundlock is IFundlock {
  address private _lendingPool;
  mapping(address => mapping(address => uint256)) internal _balances;

  constructor(address lendingPool) public {
    _lendingPool = lendingPool;
  }

  /**
   * @notice Function to deposit tokens, to be used in Ithaca
   * @param client - address of depositor
   * @param token - address of token
   * @param amount - amount to deposit
   */
  function deposit(address client, address token, uint256 amount) external {
    IERC20(token).transferFrom(msg.sender, address(this), amount);
    _balances[client][token] = _balances[client][token] + amount;
  }

  /**
   * @notice Returns the amount of tokens owned by `client`.
   */
  function balanceSheet(address client, address token) external view override returns (uint256) {
    return _balances[client][token];
  }

  function liquidationCall(
    address collateralAsset,
    address debtAsset,
    address client,
    uint256 debtToCover,
    address receiver
  ) external {
    uint256 currentAvailableCollateral = _balances[client][collateralAsset];
    uint256 liquidatorDebtAssetBalance = _balances[msg.sender][debtAsset];

    (uint256 debtLiquidated, uint256 ithacaCollateralLiquidated) = _liquidationCall(
      collateralAsset,
      debtAsset,
      client,
      debtToCover,
      receiver,
      currentAvailableCollateral
    );

    // Deduct collateral from client balance after liquidation
    _balances[client][collateralAsset] = currentAvailableCollateral - ithacaCollateralLiquidated;

    // Deduct debt repaid during liquidation from liquidator balance
    _balances[msg.sender][debtAsset] = liquidatorDebtAssetBalance - debtLiquidated;
  }

  function clientFundsLiquidationCall(
    address debtAsset,
    address client,
    uint256 debtToCover,
    address receiver
  ) external {
    uint256 currentAvailableCollateral = _balances[client][debtAsset];

    (uint256 debtLiquidated, uint256 collateralLiquidated) = _liquidationCall(
      debtAsset,
      debtAsset,
      client,
      debtToCover,
      receiver,
      currentAvailableCollateral
    );

    // Deduct collateral plus debt from client balance after liquidation
    _balances[client][debtAsset] =
      currentAvailableCollateral -
      (debtLiquidated + collateralLiquidated);
  }

  function _liquidationCall(
    address collateralAsset,
    address debtAsset,
    address client,
    uint256 debtToCover,
    address receiver,
    uint256 currentAvailableCollateral
  ) internal returns (uint256 debtLiquidated, uint256 ithacaCollateralLiquidated) {
    // Allow lending pool to pull debt asset
    IERC20(debtAsset).approve(_lendingPool, debtToCover);

    (debtLiquidated, ithacaCollateralLiquidated) = ILendingPool(_lendingPool).ithacaLiquidationCall(
      collateralAsset,
      debtAsset,
      client,
      debtToCover,
      currentAvailableCollateral
    );

    // Transfer liquidated collateral plus bonus to the receiver
    _balances[receiver][collateralAsset] += ithacaCollateralLiquidated;

    // Revoke approval
    IERC20(debtAsset).approve(_lendingPool, 0);
  }
}
