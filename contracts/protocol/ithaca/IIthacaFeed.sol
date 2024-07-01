// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

interface IIthacaFeed {
  event ClientUpdated(uint64 backendId);
  struct Client {
    address client;
    ClientParams params;
  }

  struct ClientParams {
    int256 maintenanceMargin;
    int256 mtm;
    uint256 collateral;
    uint256 valueAtRisk;
  }

  function getClientData(address client) external view returns (ClientParams calldata);
}
