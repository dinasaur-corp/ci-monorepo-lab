export function respond(pathname) {
  return { worker: "coworker-channel", route: "/coworkers/*", pathname };
}
