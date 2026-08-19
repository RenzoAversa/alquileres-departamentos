export default [
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly", document: "readonly", console: "readonly",
        fetch: "readonly", location: "readonly", navigator: "readonly",
        setTimeout: "readonly", clearTimeout: "readonly", setInterval: "readonly", clearInterval: "readonly",
        requestAnimationFrame: "readonly", FormData: "readonly", Intl: "readonly",
        Date: "readonly", Promise: "readonly", Math: "readonly", JSON: "readonly",
        Object: "readonly", Array: "readonly", Number: "readonly", String: "readonly",
        Set: "readonly", Map: "readonly", Blob: "readonly", URL: "readonly",
        Event: "readonly", CustomEvent: "readonly", MutationObserver: "readonly",
        alert: "readonly", confirm: "readonly", localStorage: "readonly",
        L: "readonly", XLSX: "readonly"
      }
    },
    rules: {
      "no-undef": "error",
      "no-unused-vars": "warn",
      "no-dupe-keys": "error",
      "no-dupe-args": "error",
      "no-redeclare": "error",
      "no-const-assign": "error",
      "no-unreachable": "error",
      "no-cond-assign": "error",
      "use-isnan": "error",
      "valid-typeof": "error"
    }
  }
];
