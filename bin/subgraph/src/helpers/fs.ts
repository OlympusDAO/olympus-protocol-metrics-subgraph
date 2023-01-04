import { readdirSync } from "fs"

export const getDirectories = (path: string, includePath = false): string[] => {
    return readdirSync(path, { withFileTypes: true }).filter(f => f.isDirectory()).map(f => `${includePath ? `${path}/` : ""}${f.name}`);
}
