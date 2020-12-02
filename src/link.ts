import { ApolloLink, Observable } from "@apollo/client/core";
import setValue from "set-value";
import { execute, ExecutionResult } from "graphql";
import { makeExecutableSchema } from "@graphql-tools/schema";

function isAsyncIterable<T>(iterable: any): iterable is AsyncIterable<T> {
  return iterable && typeof iterable[Symbol.asyncIterator] === "function";
}

function createPath(result: { path: Array<string | number> }): string {
  return result.path.join(".");
}

function hasPath<T>(
  result: any
): result is T & {
  path: any[];
} {
  return Array.isArray(result.path);
}

function zzz(time: number) {
  console.log("wait 3s for new data");
  return new Promise((resolve) => setTimeout(resolve, time));
}

function generateData(startAt = 0, amount: number) {
  const list: number[] = [];

  for (let i = 1; i <= amount; i++) {
    list.push(startAt + i);
  }

  return list;
}

export function SchemaLink() {
  const schema = makeExecutableSchema({
    typeDefs: /* GraphQL */ `
      type Query {
        stream: [Int!]
      }
    `,
    resolvers: {
      Query: {
        stream: async function* () {
          const initialData = generateData(0, 5);
          yield* initialData;

          await zzz(3000);
          const lazyData = generateData(5, 5);
          yield* lazyData;
        },
      },
    },
  });

  return new ApolloLink((operation) => {
    return new Observable((observer) => {
      async function handleResult(
        result: ExecutionResult<any> | AsyncIterable<ExecutionResult<any>>
      ) {
        if (!isAsyncIterable(result)) {
          if (!observer.closed) {
            observer.next(result);
            observer.complete();
          }
        } else {
          let initialResult: any = {};

          for await (const payload of result) {
            if (!observer.closed) {
              if (payload.data && !hasPath(payload)) {
                initialResult = payload;
              }

              if (!payload.hasNext) {
                observer.complete();
              } else {
                if (hasPath(payload)) {
                  initialResult.data = setValue(
                    initialResult.data,
                    createPath(payload),
                    payload.data
                  );
                }
                // we could debounce it
                observer.next(initialResult);
              }
            }
          }
        }
      }

      try {
        Promise.resolve(
          execute({
            schema,
            document: operation.query,
          })
        )
          .then(handleResult)
          .catch((error) => {
            if (!observer.closed) {
              observer.error(error);
            }
          });
      } catch (error) {
        if (!observer.closed) {
          observer.error(error);
        }
      }
    });
  });
}
