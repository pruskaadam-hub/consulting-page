import { spawnSync } from "node:child_process";
import path from "node:path";
const result = spawnSync(
  "deno",
  [
    "test",
    "--config",
    "supabase/functions/deno.json",
    "--frozen",
    "--allow-env",
    "--allow-read",
    "--allow-sys=hostname",
    "supabase/functions/admin-api/index.test.ts",
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      DENO_DIR: process.env.DENO_DIR || path.resolve("../.cache/deno"),
      DENO_NO_PACKAGE_JSON: "1",
      PATH:
        path.resolve("node_modules/.bin") + path.delimiter + process.env.PATH,
    },
  },
);
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
