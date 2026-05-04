import { runVfsConformance } from "../src/test-conformance.js";
import { MemoryDriver } from "../src/index.js";

runVfsConformance("MemoryDriver", () => new MemoryDriver());
