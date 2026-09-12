import { seed } from "./seed";

await seed();
console.log("seeded");

// Neither driver releases the event loop on its own — pg.Pool keeps its
// sockets, PGlite keeps its WASM instance — so without this the command never
// returns and wave 0 cannot run unattended.
process.exit(0);
