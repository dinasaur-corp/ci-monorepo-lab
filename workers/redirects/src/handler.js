export function respond(pathname) {
  return { worker: "redirects", route: "/go/*", pathname };
}
