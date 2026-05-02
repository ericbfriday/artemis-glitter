import type { PacketDefinition } from "./types";

export class PacketRegistry {
  private byType = new Map<string, PacketDefinition>();
  private byName = new Map<string, PacketDefinition>();

  private static key(type: number, subtype: number | null): string {
    return subtype === null ? `${type}` : `${type}:${subtype}`;
  }

  register(def: PacketDefinition): void {
    const key = PacketRegistry.key(def.type, def.subtype);
    if (this.byType.has(key)) {
      throw new Error(`Duplicate packet registration for type=${def.type} subtype=${def.subtype}`);
    }
    this.byType.set(key, def);
    this.byName.set(def.name, def);
  }

  getByType(type: number, subtype?: number | null): PacketDefinition | undefined {
    const key = PacketRegistry.key(type, subtype ?? null);
    return this.byType.get(key);
  }

  getByName(name: string): PacketDefinition | undefined {
    return this.byName.get(name);
  }

  all(): PacketDefinition[] {
    return [...this.byType.values()];
  }
}
