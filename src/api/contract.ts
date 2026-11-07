/* Compile-time guard between the server's JSON (src/api/schema.d.ts, generated from its OpenAPI)
   and the types the app uses. The server leaves empty fields out of its JSON, while the generated
   types say `x?: T | null`; the app says `x?: T`. `Wire` reads `null` as "absent" so the two can be
   compared, and an `Assert` line then fails `tsc` as soon as a field is renamed, retyped or added
   on one side only. */
export type Wire<T> = T extends null
  ? undefined
  : T extends readonly (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T

/** `Assert<Wire<ServerType>, AppType>` compiles only when the server's type can be used as the app's. */
export type Assert<Server extends App, App> = Server
