// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

/**
 * @title IFundlock
 * @notice Fundlock is a smart contract managing client deposits.
 */
interface IFundlock {
  function balanceSheet(address client, address token) external view returns (uint256);
}
