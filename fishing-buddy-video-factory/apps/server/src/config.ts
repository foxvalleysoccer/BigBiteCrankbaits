import path from "node:path";

function readString(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function readBoolean(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}

export type FactoryConfig = {
  port: number;
  dataRoot: string;
  sqlitePath: string;
  scheduledPolling: boolean;
  corsOrigin: string;
};

export function loadConfig(): FactoryConfig {
  const dataRoot = readString("FACTORY_DATA_ROOT", path.resolve("data"));

  return {
    port: Number(process.env.PORT ?? 4307),
    dataRoot,
    sqlitePath: readString("SQLITE_PATH", path.join(dataRoot, "factory.db")),
    scheduledPolling: readBoolean("ENABLE_SCHEDULED_POLLING", false),
    corsOrigin: readString("CORS_ORIGIN", "*")
  };
}
