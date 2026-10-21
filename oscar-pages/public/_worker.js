// Oscars underdomæner (bryllup./firmafest.oscartjoensson.dk) -> Cloudflare Pages -> intern service binding til
// Worker "fuldtbooketmusiker". Adressen bevares, så Worker'en ser Oscars værtsnavn og viser hans side.
// Pages bruges, fordi Pages kan få egne domæner fra DNS hos Simply (CNAME) uden Cloudflare for SaaS.
export default {
  fetch(request, env) {
    return env.APP.fetch(request);
  },
};
