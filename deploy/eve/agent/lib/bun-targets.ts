/** Bun treats bare nonstandard filenames as discovery filters, which may skip a pinned evaluator. */
export function assertBunTargets(argv: string[], pinnedFiles: string[]) {
  if (argv[0] !== "bun" || argv[1] !== "test") return;
  for (let index = 2; index < argv.length; index++) {
    const arg = argv[index];
    if (
      ["--preload", "--config", "-t", "--test-name-pattern", "--reporter-outfile"].includes(arg)
    ) {
      index++;
      continue;
    }
    if (!pinnedFiles.includes(arg)) continue;
    const name = arg.split("/").at(-1)!;
    if (/\.[cm]?[jt]sx?$/.test(name) && !/(?:\.test\.|_test_|\.spec\.|_spec_)/.test(name))
      throw new Error(`Pinned Bun evaluator requires an explicit path: use ./${arg}`);
  }
}
