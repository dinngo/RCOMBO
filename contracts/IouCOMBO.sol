pragma solidity 0.7.6;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./hegic/GradualTokenSwap/contracts/GradualTokenSwap.sol";

contract IouCOMBO is ERC20, GradualTokenSwap {
    // prettier-ignore
    IERC20 public constant COMBO = IERC20(0xfFffFffF2ba8F66D4e51811C5190992176930278);

    constructor(uint256 _amount, uint256 _start)
        ERC20("Furucombo IOU", "IOUCOMBO")
        GradualTokenSwap(_start, 360 days, IERC20(address(this)), COMBO)
    {
        uint256 supply = _amount * (10**uint256(decimals()));
        _mint(msg.sender, supply);
    }

    /**
     * @dev Allow the transferFrom from contract itself.
     */
    function transferFrom(
        address sender,
        address recipient,
        uint256 amount
    ) public override returns (bool) {
        _transfer(sender, recipient, amount);
        if (_msgSender() != address(this)) {
            _approve(
                sender,
                _msgSender(),
                _allowances[sender][_msgSender()].sub(
                    amount,
                    "ERC20: transfer amount exceeds allowance"
                )
            );
        }
        return true;
    }

    /**
     * @dev Provide IOUCOMBO tokens to the contract for later exchange
     * on `user`'s behalf.
     */
    function provideFor(address user, uint256 amount) external {
        rHEGIC.safeTransferFrom(msg.sender, address(this), amount);
        provided[user] = provided[user].add(amount);
    }

    /**
     * @dev Withdraw unlocked user's COMBO tokens on `user`'s behalf.
     */
    function withdrawFor(address user) external {
        uint256 amount = available(user);
        require(amount > 0, "GTS: You are have not unlocked tokens yet");
        released[user] = released[user].add(amount);
        HEGIC.safeTransfer(user, amount);
        emit Withdrawn(user, amount);
    }
}
