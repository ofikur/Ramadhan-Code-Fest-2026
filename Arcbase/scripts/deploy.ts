import { ethers, upgrades } from "hardhat";

async function main() {
    console.log("Starting deployment for ArcBase...");

    const [deployer] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", deployer.address);

    // 1. Deploy ArcBaseCollection Implementation
    console.log("Deploying ArcBaseCollection Implementation...");
    const ArcBaseCollection = await ethers.getContractFactory("ArcBaseCollection");

    // Note: We deploy implementation separately to verify it and use it in Factory
    // But for UUPS factory pattern, Factory usually points to a logic address
    const implementation = await ArcBaseCollection.deploy();
    await implementation.waitForDeployment();
    const implementationAddress = await implementation.getAddress();

    console.log("ArcBaseCollection Implementation deployed to:", implementationAddress);

    // 2. Deploy ArcBaseFactory
    console.log("Deploying ArcBaseFactory...");
    const ArcBaseFactory = await ethers.getContractFactory("ArcBaseFactory");

    // Deploy UUPS Proxy for Factory
    const factory = await upgrades.deployProxy(ArcBaseFactory, [implementationAddress], {
        kind: "uups",
        initializer: "initialize",
    });
    await factory.waitForDeployment();
    const factoryAddress = await factory.getAddress();

    console.log("ArcBaseFactory Proxy deployed to:", factoryAddress);

    // 3. Verify Implementation is set
    // This is handled by initialize, but good to double check
    // const currentImpl = await factory.implementationContract();
    // console.log("Factory points to implementation:", currentImpl);

    console.log("Deployment Complete!");
    console.log("----------------------------------------------------");
    console.log("Factory Address:", factoryAddress);
    console.log("Collection Implementation:", implementationAddress);
    console.log("----------------------------------------------------");
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
