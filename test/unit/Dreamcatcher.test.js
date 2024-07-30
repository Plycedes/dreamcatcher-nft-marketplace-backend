const { assert, expect } = require("chai");
const { network, deployments, ethers } = require("hardhat");
const { developmentChains } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Nft Marketplace Unit Tests", function () {
          let dreamcatcher, dreamcatcherContract, simpleNft, simpleNftContract;
          const PRICE = ethers.utils.parseEther("0.1");
          const TOKEN_ID = 0;

          beforeEach(async () => {
              accounts = await ethers.getSigners();
              deployer = accounts[0];
              user = accounts[1];
              await deployments.fixture(["all"]);
              dreamcatcherContract = await ethers.getContract("Dreamcatcher");
              dreamcatcher = dreamcatcherContract.connect(deployer);
              simpleNftContract = await ethers.getContract("SimpleNFT");
              simpleNft = simpleNftContract.connect(deployer);
              await simpleNft.mintNft();
              await simpleNft.approve(dreamcatcherContract.address, TOKEN_ID);
          });

          describe("listItem", function () {
              it("emits an event after listing an item", async function () {
                  expect(await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE)).to.emit(
                      "ItemListed"
                  );
              });
              it("exclusively items that haven't been listed", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  const error = `AlreadyListed("${simpleNft.address}", ${TOKEN_ID})`;
                  //   await expect(
                  //       dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE)
                  //   ).to.be.revertedWith("AlreadyListed")
                  await expect(
                      dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith(error);
              });
              it("exclusively allows owners to list", async function () {
                  dreamcatcher = dreamcatcherContract.connect(user);
                  await simpleNft.approve(user.address, TOKEN_ID);
                  await expect(
                      dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner");
              });
              it("needs approvals to list item", async function () {
                  await simpleNft.approve(ethers.constants.AddressZero, TOKEN_ID);
                  await expect(
                      dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotApprovedForMarketplace");
              });
              it("Updates listing with seller and price", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  const listing = await dreamcatcher.getListing(simpleNft.address, TOKEN_ID);
                  assert(listing.price.toString() == PRICE.toString());
                  assert(listing.seller.toString() == deployer.address);
              });
              it("reverts if the price be 0", async () => {
                  const ZERO_PRICE = ethers.utils.parseEther("0");
                  await expect(
                      dreamcatcher.listItem(simpleNft.address, TOKEN_ID, ZERO_PRICE)
                  ).revertedWithCustomError(dreamcatcher, "Dreamcatcher__PriceMustBeAboveZero");
              });
          });
          describe("cancelListing", function () {
              it("reverts if there is no listing", async function () {
                  const error = `NotListed("${simpleNft.address}", ${TOKEN_ID})`;
                  await expect(
                      dreamcatcher.cancelListing(simpleNft.address, TOKEN_ID)
                  ).to.be.revertedWith(error);
              });
              it("reverts if anyone but the owner tries to call", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  dreamcatcher = dreamcatcherContract.connect(user);
                  await simpleNft.approve(user.address, TOKEN_ID);
                  await expect(
                      dreamcatcher.cancelListing(simpleNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotOwner");
              });
              it("emits event and removes listing", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  expect(await dreamcatcher.cancelListing(simpleNft.address, TOKEN_ID)).to.emit(
                      "ItemCanceled"
                  );
                  const listing = await dreamcatcher.getListing(simpleNft.address, TOKEN_ID);
                  assert(listing.price.toString() == "0");
              });
          });
          describe("buyItem", function () {
              it("reverts if the item isnt listed", async function () {
                  await expect(
                      dreamcatcher.buyItem(simpleNft.address, TOKEN_ID)
                  ).to.be.revertedWith("NotListed");
              });
              it("reverts if the price isnt met", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  await expect(
                      dreamcatcher.buyItem(simpleNft.address, TOKEN_ID)
                  ).to.be.revertedWith("PriceNotMet");
              });
              it("transfers the nft to the buyer and updates internal proceeds record", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  dreamcatcher = dreamcatcherContract.connect(user);
                  expect(
                      await dreamcatcher.buyItem(simpleNft.address, TOKEN_ID, { value: PRICE })
                  ).to.emit("ItemBought");
                  const newOwner = await simpleNft.ownerOf(TOKEN_ID);
                  const deployerProceeds = await dreamcatcher.getProceeds(deployer.address);
                  assert(newOwner.toString() == user.address);
                  assert(deployerProceeds.toString() == PRICE.toString());
              });
          });
          describe("updateListing", function () {
              it("must be owner and listed", async function () {
                  await expect(
                      dreamcatcher.updateListing(simpleNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotListed");
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  dreamcatcher = dreamcatcherContract.connect(user);
                  await expect(
                      dreamcatcher.updateListing(simpleNft.address, TOKEN_ID, PRICE)
                  ).to.be.revertedWith("NotOwner");
              });
              it("reverts if new price is 0", async function () {
                  const updatedPrice = ethers.utils.parseEther("0");
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  await expect(
                      dreamcatcher.updateListing(simpleNft.address, TOKEN_ID, updatedPrice)
                  ).to.be.revertedWith("PriceMustBeAboveZero");
              });
              it("updates the price of the item", async function () {
                  const updatedPrice = ethers.utils.parseEther("0.2");
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  expect(
                      await dreamcatcher.updateListing(simpleNft.address, TOKEN_ID, updatedPrice)
                  ).to.emit("ItemListed");
                  const listing = await dreamcatcher.getListing(simpleNft.address, TOKEN_ID);
                  assert(listing.price.toString() == updatedPrice.toString());
              });
          });
          describe("withdrawProceeds", function () {
              it("doesn't allow 0 proceed withdrawls", async function () {
                  await expect(dreamcatcher.withdrawProceeds()).to.be.revertedWith("NoProceeds");
              });
              it("withdraws proceeds", async function () {
                  await dreamcatcher.listItem(simpleNft.address, TOKEN_ID, PRICE);
                  dreamcatcher = dreamcatcherContract.connect(user);
                  await dreamcatcher.buyItem(simpleNft.address, TOKEN_ID, { value: PRICE });
                  dreamcatcher = dreamcatcherContract.connect(deployer);

                  const deployerProceedsBefore = await dreamcatcher.getProceeds(deployer.address);
                  const deployerBalanceBefore = await deployer.getBalance();
                  const txResponse = await dreamcatcher.withdrawProceeds();
                  const transactionReceipt = await txResponse.wait(1);
                  const { gasUsed, effectiveGasPrice } = transactionReceipt;
                  const gasCost = gasUsed.mul(effectiveGasPrice);
                  const deployerBalanceAfter = await deployer.getBalance();

                  assert(
                      deployerBalanceAfter.add(gasCost).toString() ==
                          deployerProceedsBefore.add(deployerBalanceBefore).toString()
                  );
              });
          });
      });

