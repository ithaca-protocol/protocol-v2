// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;

interface IIthacaFeed {
  event ClientUpdated(uint64 backendId);

  struct ClientParams {
    address client;
    int256 maintenanceMargin;
    int256 mtm;
    uint256 collateral;
    uint256 vaR;
  }

  function getClientData(
        address client
    ) external view returns (address, int256, int256, uint256, uint256) ;

}