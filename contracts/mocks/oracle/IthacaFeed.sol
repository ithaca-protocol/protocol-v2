// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IIthacaFeed} from "../../protocol/ithaca/IIthacaFeed.sol";

contract IthacaFeed is IIthacaFeed {
  ClientParams clientData;

  function setData(ClientParams memory param, uint64 backendId) external {
    clientData = param;
  }

  function getClientData(
    address client
  ) public view override returns (address, int256, int256, uint256, uint256) {
    return (
      client,
      clientData.maintenanceMargin,
      clientData.mtm,
      clientData.collateral,
      clientData.vaR
    );
  }
}
