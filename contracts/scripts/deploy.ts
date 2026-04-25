import { ethers, network } from "hardhat";

// Base Sepolia USDC (Circle test): 0x036CbD53842c5426634e7929541eC2318f3dCF7e
// Override via PAY_TOKEN env if deploying elsewhere.

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`network: ${network.name}`);
  console.log(`deployer: ${deployer.address}`);
  console.log(`balance:  ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH`);

  const factoryF = await ethers.getContractFactory("CoalitionFactory");
  const factory = await factoryF.deploy();
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log(`CoalitionFactory: ${factoryAddr}`);

  console.log(JSON.stringify({
    network: network.name,
    factory: factoryAddr,
    deployer: deployer.address,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exit(1); });
