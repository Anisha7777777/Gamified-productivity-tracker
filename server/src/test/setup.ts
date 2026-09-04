import mongoose from "mongoose";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, vi } from "vitest";
import * as testMailService from "./test-mail.service";

process.env.JWT_SECRET = "test-only-secret";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.NODE_ENV = "test";
process.env.AUTH_RATE_LIMIT_MAX = "1000";
process.env.API_RATE_LIMIT_MAX = "10000";
process.env.PASSWORD_RESET_RATE_LIMIT_MAX = "1000";
process.env.VERIFICATION_RESEND_RATE_LIMIT_MAX = "1";
process.env.MONGOMS_DOWNLOAD_DIR = `${process.cwd()}\\.mongodb-binaries`;

vi.mock("../services/email.service", () => testMailService);

let replicaSet: MongoMemoryReplSet;

beforeAll(async () => {
  replicaSet = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
  });
  await mongoose.connect(replicaSet.getUri());
});

afterEach(async () => {
  testMailService.clearTestOutbox();

  for (const collection of Object.values(mongoose.connection.collections)) {
    await collection.deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (replicaSet) {
    await replicaSet.stop();
  }
});
