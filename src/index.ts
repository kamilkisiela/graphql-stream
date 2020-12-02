import { execute } from "@apollo/client/core";
import { parse } from "graphql";
import { SchemaLink } from "./link";

async function main() {
  const obs = execute(SchemaLink(), {
    query: parse(/* GraphQL */ `
      {
        stream @stream(initialCount: 3)
      }
    `),
  });

  return new Promise<void>((resolve) => {
    obs.subscribe({
      next(result: any) {
        console.log("next", result.data.stream);
      },
      error(error) {
        console.log("error", error);
      },
      complete() {
        console.log("complete");
        resolve();
      },
    });
  });
}

main().catch((error) => {
  console.log(error);
  process.exit(1);
});
