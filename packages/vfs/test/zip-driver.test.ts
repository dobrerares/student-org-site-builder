import { runVfsConformance } from "../src/test-conformance.js";
import { ZipDriver } from "../src/index.js";

runVfsConformance("ZipDriver", () => new ZipDriver());
