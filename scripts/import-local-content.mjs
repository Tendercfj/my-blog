import {
  parseImportArguments,
  runContentImport,
} from "./import-local-content-lib.mjs";

const options = parseImportArguments(process.argv.slice(2));

if (options.help) {
  process.stdout.write(
    "用法：pnpm content:import [--apply]\n默认 dry-run；只有 --apply 才会在单事务中写入。\n",
  );
} else {
  runContentImport(options).catch((error) => {
    const message = error instanceof Error ? error.message : "未知错误";
    process.stderr.write(`导入失败：${message}\n`);
    process.exitCode = 1;
  });
}
