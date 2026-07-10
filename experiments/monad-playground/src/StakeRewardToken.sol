// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IERC165 {
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}

interface IERC1363 is IERC165 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function approve(address spender, uint256 value) external returns (bool);
    function transferAndCall(address to, uint256 value) external returns (bool);
    function transferAndCall(address to, uint256 value, bytes calldata data) external returns (bool);
    function transferFromAndCall(address from, address to, uint256 value) external returns (bool);
    function transferFromAndCall(address from, address to, uint256 value, bytes calldata data) external returns (bool);
    function approveAndCall(address spender, uint256 value) external returns (bool);
    function approveAndCall(address spender, uint256 value, bytes calldata data) external returns (bool);
}

interface IERC1363Receiver {
    function onTransferReceived(address operator, address from, uint256 value, bytes calldata data)
        external
        returns (bytes4);
}

interface IERC1363Spender {
    function onApprovalReceived(address owner, uint256 value, bytes calldata data) external returns (bytes4);
}

/// @notice A standalone ERC-20/ERC-1363 token intended for callback-based staking exercises.
contract StakeRewardToken is IERC1363 {
    error ZeroAddress();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ReceiverNotContract();
    error InvalidReceiverResponse();
    error SpenderNotContract();
    error InvalidSpenderResponse();

    string public name;
    string public symbol;
    uint8 public constant decimals = 18;
    uint256 public totalSupply;

    mapping(address account => uint256) public balanceOf;
    mapping(address owner => mapping(address spender => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    constructor(string memory tokenName, string memory tokenSymbol, uint256 initialSupply) {
        name = tokenName;
        symbol = tokenSymbol;
        _mint(msg.sender, initialSupply);
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        // 0xb0202a11 is the ERC-1363 interface id defined by EIP-1363.
        return interfaceId == type(IERC165).interfaceId || interfaceId == 0xb0202a11;
    }

    function transfer(address to, uint256 value) external returns (bool) {
        _transfer(msg.sender, to, value);
        return true;
    }

    function approve(address spender, uint256 value) external returns (bool) {
        _approve(msg.sender, spender, value);
        return true;
    }

    function transferFrom(address from, address to, uint256 value) external returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        return true;
    }

    function transferAndCall(address to, uint256 value) external returns (bool) {
        return transferAndCall(to, value, "");
    }

    function transferAndCall(address to, uint256 value, bytes memory data) public returns (bool) {
        _transfer(msg.sender, to, value);
        _checkOnTransferReceived(msg.sender, msg.sender, to, value, data);
        return true;
    }

    function transferFromAndCall(address from, address to, uint256 value) external returns (bool) {
        return transferFromAndCall(from, to, value, "");
    }

    function transferFromAndCall(address from, address to, uint256 value, bytes memory data) public returns (bool) {
        _spendAllowance(from, msg.sender, value);
        _transfer(from, to, value);
        _checkOnTransferReceived(msg.sender, from, to, value, data);
        return true;
    }

    function approveAndCall(address spender, uint256 value) external returns (bool) {
        return approveAndCall(spender, value, "");
    }

    function approveAndCall(address spender, uint256 value, bytes memory data) public returns (bool) {
        _approve(msg.sender, spender, value);
        _checkOnApprovalReceived(msg.sender, spender, value, data);
        return true;
    }

    function _transfer(address from, address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();
        uint256 fromBalance = balanceOf[from];
        if (fromBalance < value) revert InsufficientBalance();
        unchecked {
            balanceOf[from] = fromBalance - value;
            balanceOf[to] += value;
        }
        emit Transfer(from, to, value);
    }

    function _approve(address owner, address spender, uint256 value) internal {
        if (spender == address(0)) revert ZeroAddress();
        allowance[owner][spender] = value;
        emit Approval(owner, spender, value);
    }

    function _spendAllowance(address owner, address spender, uint256 value) internal {
        uint256 currentAllowance = allowance[owner][spender];
        if (currentAllowance < value) revert InsufficientAllowance();
        if (currentAllowance != type(uint256).max) {
            unchecked {
                allowance[owner][spender] = currentAllowance - value;
            }
            emit Approval(owner, spender, allowance[owner][spender]);
        }
    }

    function _checkOnTransferReceived(address operator, address from, address to, uint256 value, bytes memory data)
        internal
    {
        if (to.code.length == 0) revert ReceiverNotContract();
        bytes4 response = IERC1363Receiver(to).onTransferReceived(operator, from, value, data);
        if (response != IERC1363Receiver.onTransferReceived.selector) revert InvalidReceiverResponse();
    }

    function _checkOnApprovalReceived(address owner, address spender, uint256 value, bytes memory data) internal {
        if (spender.code.length == 0) revert SpenderNotContract();
        bytes4 response = IERC1363Spender(spender).onApprovalReceived(owner, value, data);
        if (response != IERC1363Spender.onApprovalReceived.selector) revert InvalidSpenderResponse();
    }

    function _mint(address to, uint256 value) internal {
        if (to == address(0)) revert ZeroAddress();
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }
}
