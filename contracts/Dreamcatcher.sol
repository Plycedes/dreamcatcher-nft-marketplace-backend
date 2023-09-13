//SPDX-License-Identifier: MIT

pragma solidity ^0.8.7;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

error Dreamcatcher__NotOwner();
error Dreamcatcher__PriceCannotBeZero();
error Dreamcatcher__NotApprovedForMarketplace();
error Dreamcatcher__NotListed(address nftAddress, uint256 tokenId);
error Dreamcatcher__AlreadyListed(address nftAddress, uint256 tokenId);
error Dreamcatcher__PriceNotMet(address nftAddress, uint256 tokenId, uint256 price);

contract Dreamcatcher{

    event ItemListed(
        address indexed seller,
        address indexed nftAddress,
        uint256 indexed tokenId, 
        uint256 price
    );

    event ItemBought(
        address indexed buyer,
        address indexed nftAddress,
        uint256 indexed tokenId,
        uint256 price
    );


    
    //A structure containing the info about a listed NFT
    struct Listing{
        uint256 price;
        address seller;
    }
    
    mapping(address => mapping(uint256 => Listing)) private s_listings;
    mapping(address => uint256) private s_proceeds;

    //Modifier to ensure that only the owner of a NFT can list it
    modifier isOwner(
        address nftAddress,
        uint256 tokenId,
        address spender
    ){
        IERC721 nft = IERC721(nftAddress);
        address owner = nft.ownerOf(tokenId);
        if(spender != owner){
            revert Dreamcatcher__NotOwner();
        }
        _;
    }

    //Modifer to prevent dual listing of an already listed NFT
    modifier notListed(
        address nftAddress, 
        uint256 tokenId, 
        address owner
    ){
        Listing memory listing = s_listings[nftAddress][tokenId];
        if(listing.price > 0){
            revert Dreamcatcher__AlreadyListed(nftAddress, tokenId);
        }
        _;
    }

    //Modifier to check if a NFT is listed
    modifier isListed(address nftAddress, uint256 tokenId){
        Listing memory listing = s_listings[nftAddress][tokenId];
        if(listing.price <= 0){
            revert Dreamcatcher__NotListed(nftAddress, tokenId);
        }
        _;
    }

    //Function to list a NFT
    function listNft(
        address nftAddress, 
        uint256 tokenId, 
        uint256 price
    )
        external 
        notListed(nftAddress, tokenId, msg.sender)
        isOwner(nftAddress, tokenId, msg.sender) 
    {
        //No free NFTs XD
        if(price <= 0){
            revert Dreamcatcher__PriceCannotBeZero();
        }

        //Using openzepplin's ERC721 token contract to verify if
        //the nft is approved for selling on a market place.
        IERC721 nft = IERC721(nftAddress);
        if(nft.getApproved(tokenId) != address(this)){
            revert Dreamcatcher__NotApprovedForMarketplace();
        }
        
        //Adding the approved NFT to the listing mapping and emitting an event to confirm
        s_listings[nftAddress][tokenId] = Listing(price, msg.sender);
        emit ItemListed(msg.sender, nftAddress, tokenId, price);
    }

    //Function to buy listed NFTs
    function buyNft(address nftAddress, uint256 tokenId)
        external
        payable
        isListed(nftAddress, tokenId)
    {
        Listing memory listedItem = s_listings[nftAddress][tokenId];

        //Reverts transaction if the buyer doesn't have enough eth
        if(msg.value < listedItem.price){
            revert Dreamcatcher__PriceNotMet(nftAddress, tokenId, listedItem.price);
        }

        //Updating the seller's balance, deleting the NFT from selling listing and
        //transfering the ownership of the NFT to the buyer, respectively
        s_proceeds[listedItem.seller] = s_proceeds[listedItem.seller] + msg.value;
        delete (s_listings[nftAddress][tokenId]);
        IERC721(nftAddress).safeTransferFrom(listedItem.seller, msg.sender, tokenId);

        emit ItemBought(msg.sender, nftAddress, tokenId, listedItem.price);
    }
}