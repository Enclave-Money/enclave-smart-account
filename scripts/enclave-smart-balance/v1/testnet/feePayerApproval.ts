import {
    NetworkEndpoints,
    ChainRestAuthApi,
    MsgExecuteContract,
    createTransaction,
    BigNumberInBase,
    PrivateKey,
    TxRestClient,
    privateKeyToPublicKeyBase64,
    TxGrpcClient,
    TxClientSimulateResponse,
    Network,
    getChainInfoForNetwork,
    getEndpointsForNetwork,
    MsgApproveFeepayerRequest
} from "@routerprotocol/router-chain-sdk-ts";
import dotenv from "dotenv";
dotenv.config();

async function approveFeePayerRequest(
    dAppAddress: string,
    srcChainId: string,
){
    let network = Network.Testnet;
    const endpoint = getEndpointsForNetwork(network);

    const chainInfo = getChainInfoForNetwork(network);
    const chainId = chainInfo.chainId;
    const privateKeyHash = process.env.PRIVATE_KEY_TEST_BALANCE;
    if (!privateKeyHash) {
        throw new Error("Please set your PRIVATE_KEY in the .env file");
    }
    const privateKey = PrivateKey.fromPrivateKey(privateKeyHash.substring(2,));

    const alice = privateKey.toBech32();

    console.log("Network", network, "signer", alice);
    const publicKey = privateKeyToPublicKeyBase64(
        Buffer.from(privateKeyHash.substring(2,), "hex")
    );

    console.log(publicKey, alice);
    const restClient = new TxRestClient(endpoint.lcdEndpoint);

    /** Get Faucet Accounts details */
    const aliceAccount = await new ChainRestAuthApi(
        endpoint.lcdEndpoint
    ).fetchAccount(alice);

    const feePayerMsg = MsgApproveFeepayerRequest.fromJSON({
        feepayer: alice,
        chainid: srcChainId,
        dappaddresses: dAppAddress
    });

    let simulationResponse: TxClientSimulateResponse;
    {
        let { txRaw } = createTransaction({
            message: feePayerMsg.toDirectSign(),
            memo: "",
            pubKey: publicKey,
            sequence: parseInt(aliceAccount.account.base_account.sequence, 10),
            accountNumber: parseInt(
                aliceAccount.account.base_account.account_number,
                10
            ),
            chainId: chainId,
        });

        txRaw.setSignaturesList([""]);
        const grpcClient = new TxGrpcClient(endpoint.grpcEndpoint);
        simulationResponse = await grpcClient.simulate(txRaw);
    }
    let amount = new BigNumberInBase(500000001)
        .times(parseInt((simulationResponse.gasInfo.gasUsed * 1.3).toString()))
        .toString();
    let gas = parseInt(
        (simulationResponse.gasInfo.gasUsed * 1.3).toString()
    ).toString();
    console.log("route amount and gas: ", amount, gas);

    const { signBytes, txRaw } = createTransaction({
        message: feePayerMsg.toDirectSign(),
        memo: "",
        fee: {
            amount: [
                {
                    amount: amount,
                    denom: "route",
                },
            ],
            gas: gas,
        },
        pubKey: publicKey,
        sequence: parseInt(aliceAccount.account.base_account.sequence, 10),
        accountNumber: parseInt(
            aliceAccount.account.base_account.account_number,
            10
        ),
        chainId: chainId,
    });

    /** Sign transaction */
    const signature = await privateKey.sign(signBytes);

    /** Append Signatures */
    txRaw.setSignaturesList([signature]);

    /** Broadcast transaction */
    let txxResponse = await restClient.broadcast(txRaw);
    let txResponse = await restClient.waitTxBroadcast(txxResponse.txhash);
    console.log(`txResponse =>`, txResponse);
}


approveFeePayerRequest("0x7826Ec58b3C1c52963E1D80985ccF600D13C347E","421614")