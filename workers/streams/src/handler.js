export function respond(pathname) {
  return { worker: "streams", route: "/streams/*", pathname };
}
