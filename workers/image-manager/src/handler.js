export function respond(pathname) {
  return { worker: "image-manager", route: "/images/*", pathname };
}
