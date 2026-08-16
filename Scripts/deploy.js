import { network } from "hardhat";

async function main() {
  console.log("Starting Hardhat 3 Deployment...");

  const { ethers } = await network.create();

  const CertificateSystem = await ethers.getContractFactory("CertificateSystem");
  
  console.log("Deploying contract...");
  const contract = await CertificateSystem.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`Success! CertificateSystem deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});