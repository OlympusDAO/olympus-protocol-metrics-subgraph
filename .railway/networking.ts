import type { ProjectDefinition } from "railway/iac";

export class ExposureError extends Error {}

const publicServices = new Set(["metrics-api"]);

const managedPorts: Record<string, number[]> = {
  Postgres: [5432],
  "rpc-cache-postgres": [5432],
  "rpc-cache": [4000],
  hasura: [8080],
  indexer: [9898],
  "indexer-monitor": [],
  "metrics-publisher": [],
  "metrics-api": [8080],
};

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new ExposureError("Incomplete Railway exposure lookup");
  return value as Record<string, unknown>;
}

export function currentExposure(configInput: unknown, instances: unknown) {
  const config = object(typeof configInput === "string" ? JSON.parse(configInput) : configInput);
  if (!Array.isArray(instances)) throw new ExposureError("Incomplete Railway exposure lookup");
  const services = object(
    config.services === undefined && instances.length === 0 ? {} : config.services,
  );
  const ports = new Map<string, number[]>();
  const ids = new Set<string>();
  for (const edge of instances) {
    const node = object(object(edge).node);
    const { serviceId, serviceName } = node;
    if (
      typeof serviceId !== "string" ||
      !serviceId.trim() ||
      ids.has(serviceId) ||
      typeof serviceName !== "string" ||
      !serviceName.trim() ||
      ports.has(serviceName)
    )
      throw new ExposureError("Ambiguous Railway service lookup");
    ids.add(serviceId);
    // Unknown services could hide public exposure outside the declared allowlist.
    if (!Object.hasOwn(managedPorts, serviceName))
      throw new ExposureError(
        "Unrecognized Railway service; whole-project exposure cannot be verified",
      );
    const domains = object(node.domains);
    for (const kind of ["serviceDomains", "customDomains"] as const) {
      if (!Array.isArray(domains[kind]))
        throw new ExposureError("Incomplete Railway domain lookup");
      for (const entry of domains[kind]) {
        const domain = object(entry).domain;
        if (typeof domain !== "string" || !domain.trim())
          throw new ExposureError("Incomplete Railway domain lookup");
        // Native IaC cannot delete live HTTP domains; require authorized removal first.
        if (!publicServices.has(serviceName)) {
          throw new ExposureError(
            "Unexpected public HTTP exposure; separately authorized provider removal and verification are required before planning.",
          );
        }
      }
    }
    const serviceConfig = object(services[serviceId]);
    const networking = object(serviceConfig.networking ?? {});
    const proxies = object(networking.tcpProxies ?? {});
    const active = Object.entries(proxies)
      .filter(([, value]) => value !== null)
      .map(([port]) => {
        if (!/^[1-9]\d*$/.test(port) || Number(port) > 65535)
          throw new ExposureError("Invalid Railway TCP proxy port");
        return Number(port);
      });
    ports.set(serviceName, active);
  }
  // Unmatched active config IDs could hide exposure; only deletion tombstones are safe.
  if (
    Object.entries(services).some(
      ([id, service]) =>
        !ids.has(id) &&
        service !== null &&
        !(
          typeof service === "object" &&
          !Array.isArray(service) &&
          (service as Record<string, unknown>).isDeleted === true
        ),
    )
  )
    throw new ExposureError("Unaccounted Railway config service ID");
  return ports;
}

// Empty TCP maps are a native no-op; named nulls remove managed and discovered ports.
// service() normalizes tcp entries to creation records. Apply removal tombstones
// to the final emitted project so null survives SDK normalization/serialization.
export function enforceExposure(
  definition: ProjectDefinition,
  current?: ReadonlyMap<string, number[]>,
) {
  for (const resource of definition.resources?.flat() ?? []) {
    if (resource.type !== "service" && resource.type !== "database") continue;
    if (!Object.hasOwn(managedPorts, resource.name))
      throw new Error("Declared service is missing from the whole-project exposure allowlist");
    const ports = new Set([
      ...(managedPorts[resource.name] ?? []),
      ...(current?.get(resource.name) ?? []),
    ]);
    resource.networking = {
      ...resource.networking,
      serviceDomains: {},
      customDomains: publicServices.has(resource.name)
        ? (resource.networking?.customDomains ?? {})
        : {},
      tcpProxies: Object.fromEntries(
        [...ports].sort((a, b) => a - b).map((port) => [String(port), null]),
      ),
    };
  }
  return definition;
}
