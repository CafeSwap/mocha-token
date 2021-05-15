pragma solidity ^0.6.12;

import "./lib/ReentrancyGuard.sol";
import "./lib/SafeBEP20.sol";
import "./MochaToken.sol";

interface IBrewReferral {
    /**
     * @dev Record referral.
     */
    function recordReferral(address user, address referrer) external;

    /**
     * @dev Record referral commission.
     */
    function recordReferralCommission(address referrer, uint256 commission) external;

    /**
     * @dev Get the referrer address that referred the user.
     */
    function getReferrer(address user) external view returns (address);
}

// MasterChef is the master of Brew. He can make Brew and he is a fair guy.
//
// Note that it's ownable and the owner wields tremendous power. The ownership
// will be transferred to a governance smart contract once BREW is sufficiently
// distributed and the community can show to govern itself.
//
// Have fun reading it. Hopefully it's bug-free. God bless.
contract MasterChefV2 is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeBEP20 for IBEP20;

    // Info of each user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        //
        // We do some fancy math here. Basically, any point in time, the amount of BREWs
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accBrewPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accBrewPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    // Info of each pool.
    struct PoolInfo {
        IBEP20 lpToken; // Address of LP token contract.
        uint256 allocPoint; // How many allocation points assigned to this pool. BREWs to distribute per block.
        uint256 lastRewardBlock; // Last block number that BREWs distribution occurs.
        uint256 accBrewPerShare; // Accumulated BREWs per share, times 1e12. See below.
        uint16 depositFeeBP; // Deposit fee in basis points
    }

    // The BREW TOKEN!
    MochaToken public brew;
    // Dev address.
    address public devaddr;
    // BREW tokens created per block.
    uint256 public brewPerBlock;
    // Bonus muliplier for early brew makers.
    // Deposit Fee address
    address public feeAddress;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    // Info of each user that stakes LP tokens.
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;
    mapping(IBEP20 => bool) public poolExistence;
    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;
    // The block number when BREW mining starts.
    uint256 public startBlock;
    // The totalSupply 
    uint256 public totalSupply;
    uint256 public constant HARD_CAP = 450000e18;

    // Brew referral contract address.
    IBrewReferral public brewReferral;
    // Referral commission rate in basis points.
    uint16 public referralCommissionRate = 100;
    // Max referral commission rate: 10%.
    uint16 public constant MAXIMUM_REFERRAL_COMMISSION_RATE = 1000;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint256 amount
    );
    event SetFeeAddress(address indexed user, address indexed newAddress);
    event SetDevAddress(address indexed user, address indexed newAddress);
    event UpdateEmissionRate(address indexed user, uint256 brewPerBlock);
    event ReferralCommissionPaid(address indexed user, address indexed referrer, uint256 commissionAmount);
    event RewardLockedUp(address indexed user, uint256 indexed pid, uint256 amountLockedUp);

    constructor(
        MochaToken _brew,
        address _devaddr,
        address _feeAddress,
        uint256 _brewPerBlock,
        uint256 _startBlock
    ) public {
        brew = _brew;
        devaddr = _devaddr;
        feeAddress = _feeAddress;
        brewPerBlock = _brewPerBlock;
        startBlock = _startBlock;
    }  

    modifier nonDuplicated(IBEP20 _lpToken) {
        require(poolExistence[_lpToken] == false, "nonDuplicated: duplicated");
        _;
    }

    modifier isPoolExist(uint256 _pid) {
        require(_pid < poolLength(), "isPoolExist: pool not exist");
        _;
    }

      function poolLength() public view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    function add(
        uint256 _allocPoint,
        IBEP20 _lpToken,
        uint16 _depositFeeBP,
        bool _withUpdate
    ) external onlyOwner nonDuplicated(_lpToken) {
        require(
            _depositFeeBP <= 500,
            "add: invalid deposit fee basis points" //max 5%
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock =
            block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolExistence[_lpToken] = true;
        poolInfo.push(
            PoolInfo({
                lpToken: _lpToken,
                allocPoint: _allocPoint,
                lastRewardBlock: lastRewardBlock,
                accBrewPerShare: 0,
                depositFeeBP: _depositFeeBP
            })
        );
    }

    // Update the given pool's BREW allocation point and deposit fee. Can only be called by the owner.
    function set(
        uint256 _pid,
        uint256 _allocPoint,
        uint16 _depositFeeBP,
        bool _withUpdate
    ) external onlyOwner isPoolExist(_pid) {
        require(
            _depositFeeBP <= 500,
            "set: invalid deposit fee basis points" // max 5%
        );
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(
            _allocPoint
        );
        poolInfo[_pid].allocPoint = _allocPoint;
        poolInfo[_pid].depositFeeBP = _depositFeeBP;
    }

    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        return _to.sub(_from);
    }

    // View function to see pending BREWs on frontend.
    function pendingBrew(uint256 _pid, address _user)
        external
        isPoolExist(_pid)
        view
        returns (uint256)
    {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        uint256 accBrewPerShare = pool.accBrewPerShare;
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 multiplier =
                getMultiplier(pool.lastRewardBlock, block.number);
            uint256 brewReward =
                multiplier.mul(brewPerBlock).mul(pool.allocPoint).div(
                    totalAllocPoint
                );
            if(totalSupply.add(brewReward) >= HARD_CAP){
                brewReward = HARD_CAP.sub(totalSupply);
            }    
            brewReward = brewReward.sub(brewReward.div(10));
            accBrewPerShare = accBrewPerShare.add(
                brewReward.mul(1e12).div(lpSupply)
            );
        }
        return user.amount.mul(accBrewPerShare).div(1e12).sub(user.rewardDebt);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public isPoolExist(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 lpSupply = pool.lpToken.balanceOf(address(this));
        if (lpSupply == 0 || pool.allocPoint == 0 || brewPerBlock == 0|| totalSupply == HARD_CAP ) {
            pool.lastRewardBlock = block.number;
            return;
        }
        uint256 multiplier = getMultiplier(pool.lastRewardBlock, block.number);
        uint256 brewReward = 
            multiplier.mul(brewPerBlock).mul(pool.allocPoint).div(totalAllocPoint);
        if(totalSupply.add(brewReward) >= HARD_CAP) {
            brewReward = HARD_CAP.sub(totalSupply);
            brewPerBlock = 0;
        }    
        totalSupply = totalSupply.add(brewReward);
        brew.mint(devaddr, brewReward.div(10));
        brewReward = brewReward.sub(brewReward.div(10));
        brew.mint(address(this), brewReward);
        pool.accBrewPerShare = pool.accBrewPerShare.add(
            brewReward.mul(1e12).div(lpSupply)
        );
        pool.lastRewardBlock = block.number;
    }

    // Deposit LP tokens to MasterChef for BREW allocation.
    function deposit(uint256 _pid, uint256 _amount, address _referrer) external nonReentrant isPoolExist(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        updatePool(_pid);
        if (_amount > 0 && address(brewReferral) != address(0) && _referrer != address(0) && _referrer != msg.sender) {
            brewReferral.recordReferral(msg.sender, _referrer);
        }
        if (user.amount > 0) {
            uint256 pending =
                user.amount.mul(pool.accBrewPerShare).div(1e12).sub(
                    user.rewardDebt
                );
            if (pending > 0) {
                user.rewardDebt = user.amount.mul(pool.accBrewPerShare).div(1e12);
                uint256 commissionAmount = calculateCommission(pending, msg.sender);
                safeBrewTransfer(msg.sender, (pending.sub(commissionAmount)));
                payReferralCommission(msg.sender, commissionAmount);
            }
        }
        if (_amount > 0) {
            pool.lpToken.safeTransferFrom(
                address(msg.sender),
                address(this),
                _amount
            );
            if (pool.depositFeeBP > 0) {
                uint256 depositFee = _amount.mul(pool.depositFeeBP).div(10000);
                pool.lpToken.safeTransfer(feeAddress, depositFee);
                user.amount = user.amount.add(_amount).sub(depositFee);
            } else {
                user.amount = user.amount.add(_amount);
            }
        }
        user.rewardDebt = user.amount.mul(pool.accBrewPerShare).div(1e12);
        emit Deposit(msg.sender, _pid, _amount);
    }

    // Withdraw LP tokens from MasterChef.
    function withdraw(uint256 _pid, uint256 _amount) external nonReentrant isPoolExist(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        require(user.amount >= _amount, "withdraw: not good");
        updatePool(_pid);
        uint256 pending =
            user.amount.mul(pool.accBrewPerShare).div(1e12).sub(
                user.rewardDebt
            );
        if (pending > 0) {
            user.rewardDebt = user.amount.mul(pool.accBrewPerShare).div(1e12);
            uint256 commissionAmount = calculateCommission(pending, msg.sender);
            safeBrewTransfer(msg.sender, (pending.sub(commissionAmount)));
            payReferralCommission(msg.sender, commissionAmount);
        }
        if (_amount > 0) {
            user.amount = user.amount.sub(_amount);
            pool.lpToken.safeTransfer(address(msg.sender), _amount);
        }
        user.rewardDebt = user.amount.mul(pool.accBrewPerShare).div(1e12);
        emit Withdraw(msg.sender, _pid, _amount);
    }

    // Withdraw without caring about rewards. EMERGENCY ONLY.
    function emergencyWithdraw(uint256 _pid) external nonReentrant isPoolExist(_pid) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpToken.safeTransfer(address(msg.sender), amount);
        emit EmergencyWithdraw(msg.sender, _pid, amount);
    }

    // Safe brew transfer function, just in case if rounding error causes pool to not have enough BREWs.
    function safeBrewTransfer(address _to, uint256 _amount) internal {
        uint256 brewBal = brew.balanceOf(address(this));
        if (_amount > brewBal) {
            brew.transfer(_to, brewBal);
        } else {
            brew.transfer(_to, _amount);
        }
    }

    // Update dev address by the previous dev.
    function dev(address _devaddr) external {
        require(msg.sender == devaddr && _devaddr != address(0x0), "dev: wut?");
        devaddr = _devaddr;
        emit SetDevAddress(msg.sender, _devaddr);
    }

    function setFeeAddress(address _feeAddress) external {
        require(msg.sender == feeAddress && _feeAddress != address(0x0), "setFeeAddress: FORBIDDEN");
        feeAddress = _feeAddress;
        emit SetFeeAddress(msg.sender, _feeAddress);
    }

    //Pancake has to add hidden dummy pools inorder to alter the emission, here we make it simple and transparent to all.
    function updateEmissionRate(uint256 _brewPerBlock) external onlyOwner {
        massUpdatePools();
        require(_brewPerBlock <= 1e18 ,"invalid brewPerBlock");
        brewPerBlock = _brewPerBlock;
        emit UpdateEmissionRate(msg.sender, _brewPerBlock);
    }

    // Update the brew referral contract address by the owner
    function setBrewReferral(IBrewReferral _brewReferral) public onlyOwner {
        brewReferral = _brewReferral;
    }

    // Update referral commission rate by the owner
    function setReferralCommissionRate(uint16 _referralCommissionRate) public onlyOwner {
        require(_referralCommissionRate <= MAXIMUM_REFERRAL_COMMISSION_RATE, "setReferralCommissionRate: invalid referral commission rate basis points");
        referralCommissionRate = _referralCommissionRate;
    }

    // Function used to calculate a commission on the amount
    function calculateCommission(uint256 _amount, address _user) public view returns (uint256 commissionAmount){
        commissionAmount = 0;
        if (address(brewReferral) != address(0) && referralCommissionRate > 0) {
            address referrer = brewReferral.getReferrer(_user);
            if (referrer != address(0)){
                commissionAmount = _amount.mul(referralCommissionRate).div(10000);
            }
        }
    }

    // Pay referral commission to the referrer who referred this user.
    function payReferralCommission(address _user, uint256 _commissionAmount) internal {
        if (address(brewReferral) != address(0) && referralCommissionRate > 0) {
            address referrer = brewReferral.getReferrer(_user);
            if (referrer != address(0) && _commissionAmount > 0) {
                safeBrewTransfer(referrer, _commissionAmount);
                brewReferral.recordReferralCommission(referrer, _commissionAmount);
                emit ReferralCommissionPaid(_user, referrer, _commissionAmount);
            }
        }
    }
}