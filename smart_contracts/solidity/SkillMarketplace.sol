// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SkillMarketplace
 * @notice EVM port of the original TEALScript SkillMarketplace (CORTEX / 0G).
 *
 * AI agents buy "skills" (encrypted JS modules stored on 0G Storage) directly
 * from their own wallets. On purchase the price is split 95% seller / 5% platform.
 * Purchase records live on-chain and gate access to the skill content (x402).
 *
 * Differences from the Algorand version:
 *  - Box storage  -> Solidity mappings
 *  - ipcsCid      -> storageRootHash (0G Storage root hash)
 *  - MBR payment  -> removed (no minimum-balance concept on EVM)
 *  - Native ALGO  -> native 0G token (msg.value, 18 decimals)
 */
contract SkillMarketplace {
    struct Skill {
        string name;
        string description;
        string skillType;       // Logic, Compute, State, Data
        string version;
        uint256 price;          // in wei (native 0G)
        address seller;
        string storageRootHash; // 0G Storage root hash of the encrypted skill file
        uint256 soldCount;
        uint256 listedAt;       // block timestamp
        bool active;
    }

    // ─── State ────────────────────────────────────────────────────────────
    uint256 public skillCount;
    uint256 public platformFeeBps; // basis points (500 = 5%)
    address public admin;

    mapping(uint256 => Skill) public skills;
    // skillId => buyer => purchased?
    mapping(uint256 => mapping(address => bool)) public purchased;

    // ─── Events ───────────────────────────────────────────────────────────
    event SkillListed(uint256 indexed skillId, address indexed seller, uint256 price, string storageRootHash);
    event SkillPurchased(uint256 indexed skillId, address indexed buyer, uint256 price);
    event SkillDelisted(uint256 indexed skillId);

    constructor() {
        admin = msg.sender;
        platformFeeBps = 500; // 5%
    }

    // ─── Listing ──────────────────────────────────────────────────────────
    /**
     * @notice List a new skill on the marketplace.
     * @return skillId The id assigned to the newly listed skill.
     */
    function listSkill(
        string calldata name,
        string calldata description,
        string calldata skillType,
        string calldata version,
        uint256 price,
        string calldata storageRootHash
    ) external returns (uint256) {
        require(price > 0, "Price must be greater than 0");

        uint256 skillId = ++skillCount;
        skills[skillId] = Skill({
            name: name,
            description: description,
            skillType: skillType,
            version: version,
            price: price,
            seller: msg.sender,
            storageRootHash: storageRootHash,
            soldCount: 0,
            listedAt: block.timestamp,
            active: true
        });

        emit SkillListed(skillId, msg.sender, price, storageRootHash);
        return skillId;
    }

    // ─── Purchase ─────────────────────────────────────────────────────────
    /**
     * @notice Purchase a skill. Pays the seller 95% and the platform 5%.
     *         Refunds any overpayment to the buyer.
     */
    function buySkill(uint256 skillId) external payable {
        Skill storage skill = skills[skillId];
        require(skill.seller != address(0), "Skill not found");
        require(skill.active, "Skill is no longer active");
        require(msg.sender != skill.seller, "Cannot buy your own skill");
        require(!purchased[skillId][msg.sender], "Already purchased this skill");
        require(msg.value >= skill.price, "Insufficient payment");

        uint256 platformFee = (skill.price * platformFeeBps) / 10000;
        uint256 sellerAmount = skill.price - platformFee;

        // Effects
        purchased[skillId][msg.sender] = true;
        skill.soldCount += 1;

        // Interactions
        (bool okSeller, ) = payable(skill.seller).call{value: sellerAmount}("");
        require(okSeller, "Seller payment failed");

        if (platformFee > 0) {
            (bool okAdmin, ) = payable(admin).call{value: platformFee}("");
            require(okAdmin, "Platform payment failed");
        }

        // Refund overpayment
        uint256 refund = msg.value - skill.price;
        if (refund > 0) {
            (bool okRefund, ) = payable(msg.sender).call{value: refund}("");
            require(okRefund, "Refund failed");
        }

        emit SkillPurchased(skillId, msg.sender, skill.price);
    }

    // ─── Access check (used by the x402 content gate) ───────────────────────
    function hasAccess(uint256 skillId, address buyer) external view returns (bool) {
        return purchased[skillId][buyer];
    }

    // ─── Admin / seller management ──────────────────────────────────────────
    function delistSkill(uint256 skillId) external {
        Skill storage skill = skills[skillId];
        require(skill.seller != address(0), "Skill not found");
        require(msg.sender == skill.seller || msg.sender == admin, "Not authorized");
        skill.active = false;
        emit SkillDelisted(skillId);
    }

    function setPlatformFee(uint256 feeBps) external {
        require(msg.sender == admin, "Admin only");
        require(feeBps <= 1000, "Max fee is 10%");
        platformFeeBps = feeBps;
    }

    // ─── Convenience view ───────────────────────────────────────────────────
    function getSkill(uint256 skillId) external view returns (Skill memory) {
        return skills[skillId];
    }
}
