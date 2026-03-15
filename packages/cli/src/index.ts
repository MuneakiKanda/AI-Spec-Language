#!/usr/bin/env node
// =============================================
// AI-Spec Language CLI
// =============================================

import { readFileSync } from "node:fs";
import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { parse as aispecParse } from "@aispec/core";
import type { FileResolver } from "@aispec/core";

function main(): void {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    printUsage();
    process.exit(0);
  }

  const command = args[0];
  switch (command) {
    case "parse":
      runParse(args.slice(1));
      break;
    case "validate":
      runValidate(args.slice(1));
      break;
    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

function printUsage(): void {
  console.log(`
AI-Spec Language CLI v0.2

Usage:
  aispec parse <file> [options]    Parse .aispec to JSON
  aispec validate <file>           Validate .aispec (report errors only)

Options:
  --env <key=value>    Set environment variable (repeatable)
  --output <file>      Write output to file (default: stdout)
  --pretty             Pretty-print JSON output
  -h, --help           Show this help
`.trimStart());
}

function parseArgs(args: string[]): {
  file: string;
  env: Record<string, string>;
  output: string | null;
  pretty: boolean;
} {
  let file = "";
  const env: Record<string, string> = {};
  let output: string | null = null;
  let pretty = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--env" && i + 1 < args.length) {
      const kv = args[++i];
      const eqIdx = kv.indexOf("=");
      if (eqIdx > 0) {
        env[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
      }
    } else if (arg === "--output" && i + 1 < args.length) {
      output = args[++i];
    } else if (arg === "--pretty") {
      pretty = true;
    } else if (!arg.startsWith("-")) {
      file = arg;
    }
  }

  if (!file) {
    console.error("Error: No input file specified.");
    process.exit(1);
  }

  return { file, env, output, pretty };
}

function createFileResolver(): FileResolver {
  return (importPath: string, fromFile: string): string | null => {
    try {
      const dir = dirname(fromFile);
      let fullPath = resolve(dir, importPath);
      if (!fullPath.endsWith(".aispec")) {
        fullPath += ".aispec";
      }
      return readFileSync(fullPath, "utf-8");
    } catch {
      return null;
    }
  };
}

function runParse(args: string[]): void {
  const { file, env, output, pretty } = parseArgs(args);
  const filePath = resolve(file);

  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const result = aispecParse(source, filePath, {
    env,
    fileResolver: createFileResolver(),
  });

  if (!result.success) {
    const report = {
      errors: result.errors,
      warnings: result.warnings,
      summary: {
        total_errors: result.errors.length,
        total_warnings: result.warnings.length,
        parseable: false,
      },
    };
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }

  const json = pretty
    ? JSON.stringify(result.output, null, 2)
    : JSON.stringify(result.output);

  if (output) {
    writeFileSync(output, json + "\n", "utf-8");
    console.log(`Output written to: ${output}`);
  } else {
    console.log(json);
  }
}

function runValidate(args: string[]): void {
  const { file, env } = parseArgs(args);
  const filePath = resolve(file);

  let source: string;
  try {
    source = readFileSync(filePath, "utf-8");
  } catch {
    console.error(`Error: Cannot read file: ${filePath}`);
    process.exit(1);
  }

  const result = aispecParse(source, filePath, {
    env,
    fileResolver: createFileResolver(),
  });

  const report = {
    errors: result.errors,
    warnings: result.warnings,
    summary: {
      total_errors: result.errors.length,
      total_warnings: result.warnings.length,
      parseable: result.success,
    },
  };

  console.log(JSON.stringify(report, null, 2));
  process.exit(result.success ? 0 : 1);
}

main();
