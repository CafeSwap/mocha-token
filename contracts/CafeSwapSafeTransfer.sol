// SPDX-License-Identifier: MIT

pragma solidity 0.6.12;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract CafeSwapSafeTransfer is Ownable {
    // The MOCHA TOKEN!
    IERC20 public mocha;

    constructor(IERC20 _mocha) public {
        mocha = IERC20(_mocha);
    }

    // Safe mocha transfer function, just in case if rounding error causes pool to not have enough CAKEs.
    function safeMochaTransfer(address _to, uint256 _amount) public onlyOwner {
        uint256 mochaBal = mocha.balanceOf(address(this));
        if (_amount > mochaBal) {
            mocha.transfer(_to, mochaBal);
        } else {
            mocha.transfer(_to, _amount);
        }
    }
}
