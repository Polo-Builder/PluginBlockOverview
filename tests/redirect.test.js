import test from "node:test";
import assert from "node:assert/strict";
import { RULES } from "../redirect.js";

// Modèle local des conditions utilisées ; ne remplace pas le moteur DNR Chrome.
function action(url, type = "main_frame", method = "get") {
  const networkURL = url.split("#")[0];
  return RULES.filter(({ condition: c }) =>
    c.resourceTypes.includes(type) && c.requestMethods.includes(method) &&
    new RegExp(c.regexFilter).test(networkURL)
  ).sort((a, b) => b.priority - a.priority)[0]?.action;
}
for (const host of ["google.com", "www.google.com", "google.fr", "www.google.fr"]) {
  for (const query of ["q=chat", "hl=fr&q=caf%C3%A9%20%26%20th%C3%A9&start=10", "q=a&udm=0", "udm=&q=a", "q=a&tbm="]) {
    test(`redirige ${host} ${query}`, () => {
      const url = `https://${host}/search?${query}`;
      const result = action(url);
      assert.equal(result?.type, "redirect");
      const transformed = new URL(url);
      for (const { key, value } of result.redirect.transform.queryTransform.addOrReplaceParams) {
        transformed.searchParams.set(key, value);
      }
      assert.equal(transformed.searchParams.get("udm"), "web");
      const original = new URL(url);
      for (const [key] of original.searchParams) {
        if (key !== "udm") assert.deepEqual(transformed.searchParams.getAll(key), original.searchParams.getAll(key));
      }
      assert.equal(action(transformed.href)?.type, "allow", "une seule redirection");
    });
  }
}
for (const filter of ["udm=web", "udm=14", "udm=2", "udm=vids", "udm=7", "udm=50", "tbm=nws", "tbm=isch", "udm=future"]) {
  test(`respecte ${filter}`, () => {
    assert.equal(action(`https://www.google.com/search?q=chat&${filter}`)?.type, "allow");
  });
}
for (const url of [
  "https://www.google.com.evil.test/search?q=chat", "https://evil.test/search?q=chat",
  "https://accounts.google.com/search?q=chat", "https://www.google.com/preferences?q=chat",
  "https://www.google.com/searching?q=chat", "https://www.google.com/search?aq=chat",
  "https://www.google.com/search?q=", "https://www.google.com/search?hl=fr#q=chat",
  "https://www.google.com/search?q", "https://www.google.com/search?next=%3Fq%3Dchat"
]) {
  test(`ne touche pas ${url}`, () => assert.equal(action(url), undefined));
}
test("pas de redirection XHR, iframe, POST ; HTTP accepté", () => {
  const url = "https://www.google.fr/search?q=chat";
  assert.equal(action(url, "xmlhttprequest"), undefined);
  assert.equal(action(url, "sub_frame"), undefined);
  assert.equal(action(url, "main_frame", "post"), undefined);
  assert.equal(action("http://www.google.fr/search?q=chat")?.type, "redirect");
});
test("les paramètres encodés ne sont pas pris pour des filtres", () => {
  assert.equal(action("https://www.google.fr/search?q=test%26udm%3D2")?.type, "redirect");
});
