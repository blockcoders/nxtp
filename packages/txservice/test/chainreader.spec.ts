import { utils, Wallet } from "ethers";
import Sinon, { restore, reset, createStubInstance, SinonStubbedInstance } from "sinon";

import { ChainReader } from "../src/chainreader";
import { ChainRpcProvider } from "../src/provider";
import {
  TEST_SENDER_CHAIN_ID,
  TEST_TX,
  TEST_READ_TX,
} from "./constants";
import {  RpcError, TransactionServiceFailure } from "../src/error";
import { getRandomAddress, getRandomBytes32, mkAddress, RequestContext, expect, Logger } from "@connext/nxtp-utils";
import { err, ok } from "neverthrow";

const logger = new Logger({
  level: process.env.LOG_LEVEL ?? "silent",
  name: "ChainReaderTest",
});

let signer: SinonStubbedInstance<Wallet>;
let chainReader: ChainReader;
let provider: SinonStubbedInstance<ChainRpcProvider>;
let context: RequestContext = {
  id: "",
  origin: "",
};

/// In these tests, we are testing the outer shell of txservice - the interface, not the core functionality.
/// For core functionality tests, see transaction.spec.ts and provider.spec.ts.
describe("ChainReader", () => {

  beforeEach(() => {
    provider = createStubInstance(ChainRpcProvider);
    signer = createStubInstance(Wallet);
    signer.connect.resolves(true);
 
    const chains = {
      [TEST_SENDER_CHAIN_ID.toString()]: {
        providers: [{ url: "https://-------------" }],
        confirmations: 1,
        gasStations: [],
      },
    };

    chainReader = new ChainReader(logger, { chains }, signer);
    Sinon.stub(chainReader as any, "getProvider").callsFake((chainId: number) => {
      // NOTE: We check to make sure we are only getting the one chainId we expect
      // to get in these unit tests.
      expect(chainId).to.be.eq(TEST_SENDER_CHAIN_ID);
      return provider;
    });
    context.id = getRandomBytes32();
    context.origin = "ChainReaderTest";
  });

  afterEach(() => {
    restore();
    reset();
  });

  describe("readTx", () => {
    it("happy: returns exactly what it reads", async () => {
      const fakeData = getRandomBytes32();
      provider.readTransaction.resolves(ok(fakeData));

      const data = await chainReader.readTx(TEST_READ_TX);

      expect(data).to.deep.eq(fakeData);
      expect(provider.readTransaction.callCount).to.equal(1);
      expect(provider.readTransaction.args[0][0]).to.deep.eq(TEST_READ_TX);
    });
  });

  describe("getProvider", () => {
    it("errors if cannot get provider", async () => {
      // Replacing this method with the original fn not working.
      (chainReader as any).getProvider.restore();
      await expect(chainReader.readTx({ ...TEST_TX, chainId: 9999 })).to.be.rejectedWith(
        TransactionServiceFailure,
      );
    });
  });

  describe("getBalance", () => {
    it("happy", async () => {
      const testBalance = utils.parseUnits("42", "ether");
      const testAddress = getRandomAddress();
      provider.getBalance.resolves(ok(testBalance));

      const balance = await chainReader.getBalance(TEST_SENDER_CHAIN_ID, testAddress);

      expect(balance.eq(testBalance)).to.be.true;
      expect(provider.getBalance.callCount).to.equal(1);
      expect(provider.getBalance.getCall(0).args[0]).to.deep.eq(testAddress);
    });

    it("should throw if provider fails", async () => {
      provider.getBalance.resolves(err(new RpcError("fail")));

      await expect(chainReader.getBalance(TEST_SENDER_CHAIN_ID, mkAddress("0xaaa"))).to.be.rejectedWith("fail");
    });
  });

  describe("getDecimalsForAsset", () => {
    it("happy", async () => {
      const decimals = 18;
      const assetId = mkAddress("0xaaa");
      provider.getDecimalsForAsset.resolves(ok(decimals));

      const retrieved = await chainReader.getDecimalsForAsset(TEST_SENDER_CHAIN_ID, assetId);

      expect(retrieved).to.be.eq(decimals);
      expect(provider.getDecimalsForAsset.callCount).to.equal(1);
      expect(provider.getDecimalsForAsset.getCall(0).args[0]).to.deep.eq(assetId);
    });

    it("should throw if provider fails", async () => {
      provider.getBalance.resolves(err(new RpcError("fail")));

      await expect(chainReader.getBalance(TEST_SENDER_CHAIN_ID, mkAddress("0xaaa"))).to.be.rejectedWith("fail");
    });
  });

  describe("getBlockTime", () => {
    it("happy", async () => {
      const time = Math.floor(Date.now() / 1000);
      provider.getBlockTime.resolves(ok(time));

      const blockTime = await chainReader.getBlockTime(TEST_SENDER_CHAIN_ID);

      expect(blockTime).to.be.eq(time);
      expect(provider.getBlockTime.callCount).to.equal(1);
    });

    it("should throw if provider fails", async () => {
      provider.getBlockTime.resolves(err(new RpcError("fail")));

      await expect(chainReader.getBlockTime(TEST_SENDER_CHAIN_ID)).to.be.rejectedWith("fail");
    });
  });
});
