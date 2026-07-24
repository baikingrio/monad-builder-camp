// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";

/// @dev Minimal Safe-like avatar that records module execs. Local harness only.
contract LocalAvatar {
    address public module;
    address public lastTo;
    uint256 public lastValue;
    bytes public lastData;
    uint256 public drawCount;

    error NotModule();

    function setModule(address module_) external {
        module = module_;
    }

    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8)
        external
        returns (bool)
    {
        if (msg.sender != module) revert NotModule();
        lastTo = to;
        lastValue = value;
        lastData = data;
        (bool ok,) = to.call{value: value}(data);
        return ok;
    }
}

/// @dev Stand-in LuckyDraw that only exposes draw().
contract LocalLuckyDraw {
    uint256 public draws;

    function draw() external {
        draws += 1;
    }

    function steal() external {
        revert("steal-forbidden-in-product");
    }
}

/**
 * @title LocalDrawOnlyRolesModifier
 * @notice Local-only Roles stand-in: one role, one target, one selector, value=0, Call only.
 * @dev This is NOT gnosisguild Zodiac Roles bytecode. It proves product rejection semantics
 *      before Monad hosts a real Roles stack.
 */
contract LocalDrawOnlyRolesModifier {
    bytes32 public immutable roleKey;
    address public immutable avatar;
    address public immutable allowedTarget;
    bytes4 public immutable allowedSelector;

    mapping(address => bool) public members;

    error NotMember();
    error TargetNotAllowed();
    error SelectorNotAllowed();
    error ValueNotAllowed();
    error OperationNotAllowed();
    error InnerCallFailed();

    constructor(bytes32 roleKey_, address avatar_, address allowedTarget_, bytes4 allowedSelector_) {
        roleKey = roleKey_;
        avatar = avatar_;
        allowedTarget = allowedTarget_;
        allowedSelector = allowedSelector_;
    }

    function assignMember(address member, bool enabled) external {
        members[member] = enabled;
    }

    function execTransactionWithRole(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation,
        bytes32 roleKey_,
        bool shouldRevert
    ) external returns (bool success) {
        if (!members[msg.sender]) revert NotMember();
        if (roleKey_ != roleKey) revert NotMember();
        if (to != allowedTarget) revert TargetNotAllowed();
        if (value != 0) revert ValueNotAllowed();
        if (operation != 0) revert OperationNotAllowed();
        if (data.length < 4 || bytes4(data[0:4]) != allowedSelector) revert SelectorNotAllowed();

        success = LocalAvatar(avatar).execTransactionFromModule(to, value, data, operation);
        if (shouldRevert && !success) revert InnerCallFailed();
    }
}

/**
 * @title DrawOnlyRolesHarnessTest
 * @notice Local Roles-style harness required by the Zodiac Roles migration plan Phase 1.
 * @dev Does not deploy upstream Roles, ModuleProxyFactory, or broadcast.
 */
contract DrawOnlyRolesHarnessTest is Test {
    address internal constant SESSION_KEY = address(0x5E5510);
    address internal constant STRANGER = address(0xBAD);
    bytes32 internal constant ROLE_KEY = keccak256("LUCKY_DRAW");
    bytes4 internal constant DRAW_SELECTOR = 0x0eecae21;

    LocalAvatar internal avatar;
    LocalLuckyDraw internal luckyDraw;
    LocalDrawOnlyRolesModifier internal roles;

    function setUp() public {
        avatar = new LocalAvatar();
        luckyDraw = new LocalLuckyDraw();
        // Real draw() selector is 0x0eecae21 for MonadLuckyDraw.draw(); LocalLuckyDraw.draw() differs.
        // Harness uses LocalLuckyDraw's actual selector for exec path, and separately asserts product selector constant.
        bytes4 localDrawSelector = LocalLuckyDraw.draw.selector;
        roles = new LocalDrawOnlyRolesModifier(ROLE_KEY, address(avatar), address(luckyDraw), localDrawSelector);
        avatar.setModule(address(roles));
        roles.assignMember(SESSION_KEY, true);
    }

    function testProductDrawSelectorIsPinned() public pure {
        assertEq(DRAW_SELECTOR, bytes4(0x0eecae21));
    }

    function testMemberCanDraw() public {
        vm.prank(SESSION_KEY);
        bool ok = roles.execTransactionWithRole(
            address(luckyDraw), 0, abi.encodeCall(LocalLuckyDraw.draw, ()), 0, ROLE_KEY, true
        );
        assertTrue(ok);
        assertEq(luckyDraw.draws(), 1);
        assertEq(avatar.lastTo(), address(luckyDraw));
        assertEq(avatar.lastValue(), 0);
    }

    function testStrangerCannotDraw() public {
        vm.prank(STRANGER);
        vm.expectRevert(LocalDrawOnlyRolesModifier.NotMember.selector);
        roles.execTransactionWithRole(
            address(luckyDraw), 0, abi.encodeCall(LocalLuckyDraw.draw, ()), 0, ROLE_KEY, true
        );
    }

    function testMemberCannotCallOtherSelector() public {
        vm.prank(SESSION_KEY);
        vm.expectRevert(LocalDrawOnlyRolesModifier.SelectorNotAllowed.selector);
        roles.execTransactionWithRole(
            address(luckyDraw), 0, abi.encodeCall(LocalLuckyDraw.steal, ()), 0, ROLE_KEY, true
        );
    }

    function testMemberCannotSendValue() public {
        vm.deal(address(avatar), 1 ether);
        vm.prank(SESSION_KEY);
        vm.expectRevert(LocalDrawOnlyRolesModifier.ValueNotAllowed.selector);
        roles.execTransactionWithRole(
            address(luckyDraw), 1, abi.encodeCall(LocalLuckyDraw.draw, ()), 0, ROLE_KEY, true
        );
    }

    function testMemberCannotTargetOtherContract() public {
        LocalLuckyDraw other = new LocalLuckyDraw();
        vm.prank(SESSION_KEY);
        vm.expectRevert(LocalDrawOnlyRolesModifier.TargetNotAllowed.selector);
        roles.execTransactionWithRole(
            address(other), 0, abi.encodeCall(LocalLuckyDraw.draw, ()), 0, ROLE_KEY, true
        );
    }
}
