const ethers = require("ethers");

const RPC = "https://sepolia.base.org";
const WALLET = "0x19d47570BA52E058bD6432009b2705F799b851Dc";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e";

const provider = new ethers.JsonRpcProvider(RPC);

const ABI = ["function balanceOf(address) view returns (uint256)"];
const usdc = new ethers.Contract(USDC, ABI, provider);

usdc.balanceOf(WALLET).then(balance => {
  console.log("USDC Balance:", ethers.formatUnits(balance, 6), "USDC");
});
