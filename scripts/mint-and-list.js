const { ethers } = require("hardhat");

const PRICE = ethers.parseEther("0.1");

async function mintAndList() {
    const dreamcatcher = await ethers.getContract("Dreamcatcher");
    const simpleNft = await ethers.getContract("SimpleNFT");
    console.log("Minting...");
    const mintTx = await simpleNft.mintNft();
    const mintTxReceipt = await mintTx.wait(1);
    console.log(mintTxReceipt);
    const tokenId = mintTxReceipt.events[0].args.tokenId;
    console.log("Approving NFT...");

    const approvalTx = await simpleNft.approve(dreamcatcher.address, tokenId);
    await approvalTx.wait(1);
    const tx = await dreamcatcher.listItem(simpleNft.address, tokenId, PRICE);
    await tx.wait(1);
    console.log("Listed");
}

mintAndList()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
