import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract, Signer } from "ethers";
import { P256Verifier } from "../typechain-types";

describe("P256Verifer", function(){
    let p256Verifer:P256Verifier;

    beforeEach(async function () {
        p256Verifer = await ethers.deployContract("P256Verifier");

    })

    it("Should verifySignature", async function(){
        const msgHash =
        "0xbb5a52f42f9c9261ed4361f59422a1e30036e7c32b270c8807a419feca605023";
        const r = BigInt("19738613187745101558623338726804762177711919211234071563652772152683725073944");
        const s = BigInt("34753961278895633991577816754222591531863837041401341770838584739693604822390");
        const x = BigInt("18614955573315897657680976650685450080931919913269223958732452353593824192568");
       const  y = BigInt("90223116347859880166570198725387569567414254547569925327988539833150573990206");
       const result = await p256Verifer.ecdsa_verify(msgHash, r, s, [x, y]);
       console.log(result);
    })
})