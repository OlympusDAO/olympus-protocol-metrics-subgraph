export function benchmarkPostgresImage(images, currentReference) {
  const reference = images[currentReference]
    ? currentReference
    : "docker.io/library/postgres:17-alpine";
  const id = images[reference];
  if (!id) throw Error("Baseline has no PostgreSQL image identity");
  return { reference, id };
}
