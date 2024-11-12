// SPDX-License-Identifier: MIT
pragma solidity 0.6.12;
pragma experimental ABIEncoderV2;

import {IIthacaFeed} from '../../interfaces/ithaca/IIthacaFeed.sol';

contract MockIthacaFeed is IIthacaFeed {
  mapping(address => ClientParams) internal _clients;

  function updateData(Client[] memory clients, uint64 backendId) external {
    for (uint256 i; i < clients.length; i++) {
      Client memory clientData = clients[i];
      _clients[clientData.client] = clientData.params;
    }

    emit ClientUpdated(backendId);
  }

  function getClientData(address client) external view override returns (ClientParams memory) {
    return _clients[client];
  }
}
