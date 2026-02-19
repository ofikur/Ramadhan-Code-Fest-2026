import { artifacts } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
    const collectionArtifact = await artifacts.readArtifact("ArcBaseCollection");
    const factoryArtifact = await artifacts.readArtifact("ArcBaseFactory");

    const abis = {
        collection: collectionArtifact.abi,
        factory: factoryArtifact.abi,
    };

    const outputPath = path.join(__dirname, "../frontend/abis.js");
    const content = `export const ABIS = ${JSON.stringify(abis, null, 2)};`;

    fs.writeFileSync(outputPath, content);
    console.log(`ABIs exported to ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
