// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CafeSwapSafeTransfer is Ownable {
    // The Brew TOKEN!
    IERC20 public brew;

    constructor(IERC20 _brew) public {
        brew = IERC20(_brew);
    }

    // Safe brew transfer function, just in case if rounding error causes pool
    // to not have enough BREWs.
    function safeBrewTransfer(address _to, uint256 _amount) public onlyOwner {
        uint256 brewBal = brew.balanceOf(address(this));
        if (_amount > brewBal) {
            brew.transfer(_to, brewBal);
        } else {
            brew.transfer(_to, _amount);
        }
    }
}
