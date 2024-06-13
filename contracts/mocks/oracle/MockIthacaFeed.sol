// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IIthacaFeed} from "../../protocol/ithaca/IIthacaFeed.sol";

contract MockIthacaFeed is IIthacaFeed {
  ClientParams clientData;

  function setData(ClientParams memory param, uint64 backendId) external {
    clientData = param;
  }

  function getClientData(address client) public view override returns (ClientParams memory) {
    return clientData;
  }
}
